import type { ILanguageRunner, ExecutionResult } from './LanguageRunner';
import { bundle } from './bundler';

export class JSRunner implements ILanguageRunner {
  private worker: Worker | null = null;

  supports(extension: string): boolean {
    return ['js', 'mjs', 'ts', 'jsx', 'tsx'].includes(extension);
  }

  async run(
    files: Record<string, string>, 
    entryPoint: string, 
    onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void, 
    onRender?: (code: string) => void
  ): Promise<ExecutionResult> {
    try {
      const bundledCode = await bundle(files, entryPoint);
      
      if (this.worker) {
        this.worker.terminate();
      }

      const workerCode = `
        const originalConsole = {
          log: console.log,
          error: console.error,
          warn: console.warn,
          info: console.info,
        };

        const sendLog = (type, args) => {
          self.postMessage({ type: 'log', logType: type, content: args });
        };

        console.log = (...args) => sendLog('log', args);
        console.error = (...args) => sendLog('error', args);
        console.warn = (...args) => sendLog('warn', args);
        console.info = (...args) => sendLog('info', args);

        self.onmessage = (e) => {
          if (e.data.type === 'execute') {
            try {
              const start = performance.now();
              
              // If code looks like it wants DOM access, send it back for main-thread rendering
              // Simple heuristic: check for 'react-dom' or 'document.getElementById'
              if (e.data.code.includes('react-dom') || e.data.code.includes('document.getElementById')) {
                 self.postMessage({ type: 'render', code: e.data.code });
                 self.postMessage({ type: 'done', duration: 0 }); // We consider bundling "done"
                 return;
              }

              eval(e.data.code);
              const end = performance.now();
              self.postMessage({ type: 'done', duration: end - start });
            } catch (err) {
              self.postMessage({ type: 'log', logType: 'error', content: [err.message] });
              self.postMessage({ type: 'done', duration: 0 });
            }
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));

      return new Promise<ExecutionResult>((resolve) => {
        let settled = false;

        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            if (this.worker) {
              this.worker.terminate();
              this.worker = null;
            }
            onLog('error', ['Execution timed out after 5 seconds']);
            resolve({ duration: 5000, stdout: [], stderr: ['Timeout'], error: 'Timeout' });
          }
        }, 5000);

        this.worker!.onmessage = (e) => {
          if (e.data.type === 'log') {
            onLog(e.data.logType, e.data.content);
          } else if (e.data.type === 'render') {
             if (onRender) onRender(e.data.code);
          } else if (e.data.type === 'done') {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              this.worker?.terminate();
              this.worker = null;
              resolve({ duration: e.data.duration, stdout: [], stderr: [] });
            }
          }
        };

        this.worker!.postMessage({ type: 'execute', code: bundledCode });
      });
    } catch (err: any) {
      onLog('error', [err.message]);
      return { duration: 0, stdout: [], stderr: [err.message], error: err.message };
    }
  }

  stop() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
