import type { ILanguageRunner, ExecutionResult } from './LanguageRunner';
import { LANGUAGE_MAP } from '../data/languages';

export class RemoteRunner implements ILanguageRunner {
  supports(extension: string): boolean {
    // Supports anything in our map that isn't handled locally (JS/TS/Py/HTML are local)
    const local = ['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'htm'];
    return !!LANGUAGE_MAP[extension] && !local.includes(extension);
  }

  async run(
    files: Record<string, string>, 
    entryPoint: string, 
    onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void,
    _onRender?: (code: string) => void
  ): Promise<ExecutionResult> {
    const extension = entryPoint.split('.').pop() || '';
    const config = LANGUAGE_MAP[extension];

    if (!config) {
      return { stdout: [], stderr: ['Unsupported language'], duration: 0, error: 'Unsupported' };
    }

    onLog('info', [`Running ${config.name} remotely via Piston API...`]);

    try {
      const start = performance.now();
      
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: config.pistonRuntime,
          version: config.pistonVersion,
          files: [
            {
              name: entryPoint,
              content: files[entryPoint]
            }
          ]
        })
      });

      const result = await response.json();
      const end = performance.now();

      if (result.run) {
        if (result.run.stdout) onLog('log', [result.run.stdout]);
        if (result.run.stderr) onLog('error', [result.run.stderr]);
        
        return {
          stdout: result.run.stdout ? [result.run.stdout] : [],
          stderr: result.run.stderr ? [result.run.stderr] : [],
          duration: end - start,
          error: result.run.code !== 0 ? 'Execution failed' : undefined
        };
      } else {
        throw new Error('Invalid response from execution server');
      }

    } catch (err: any) {
      onLog('error', [`Remote Execution Error: ${err.message}`]);
      return { stdout: [], stderr: [err.message], duration: 0, error: err.message };
    }
  }
}
