import { registry } from './LanguageRunner';
import { JSRunner } from './JSRunner';
import { PythonRunner } from './PythonRunner';
import { RemoteRunner } from './RemoteRunner';
import { HTMLRunner } from './HTMLRunner';

// Register runners
const jsRunner = new JSRunner();
const pyRunner = new PythonRunner();
const remoteRunner = new RemoteRunner();
const htmlRunner = new HTMLRunner();

registry.register(jsRunner);
registry.register(pyRunner);
registry.register(remoteRunner);
registry.register(htmlRunner);

export class Runner {
  async run(files: Record<string, string>, entryPoint: string, onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void, onRender?: (code: string) => void) {
    const runner = registry.getRunner(entryPoint);
    
    if (!runner) {
      onLog('error', [`No runner found for file: ${entryPoint}`]);
      return { duration: 0 };
    }

    return runner.run(files, entryPoint, onLog, onRender);
  }

  async runTests(files: Record<string, string>, entryPoint: string, testCases: any[], onLog: (type: string, content: any[]) => void) {
    if (entryPoint.endsWith('.js') || entryPoint.endsWith('.ts')) {
        // Quick hack: Import bundle and run purely for JS/TS here to keep challenges working
        // In a real app, JSRunner would expose this method.
        const { bundle } = await import('./bundler');
        
        try {
          const content = files[entryPoint];
          const functionMatch = content.match(/function\s+([a-zA-Z0-9_]+)/);
          const functionName = functionMatch ? functionMatch[1] : null;

          if (!functionName) {
            throw new Error("Could not find a function to test. Make sure you use 'function functionName(...)'");
          }

          const harness = `
            const results = [];
            const cases = ${JSON.stringify(testCases)};
            const targetFn = self.SyntaxArkOutput ? self.SyntaxArkOutput["${functionName}"] : ${functionName};
            
            if (typeof targetFn !== 'function') {
              throw new Error("Function '${functionName}' not found in bundle.");
            }

            for (const tc of cases) {
              try {
                const actual = targetFn(...tc.input);
                const passed = JSON.stringify(actual) === JSON.stringify(tc.expected);
                results.push({ name: tc.name, passed, actual, expected: tc.expected });
              } catch (err) {
                results.push({ name: tc.name, passed: false, actual: err.message, expected: tc.expected });
              }
            }
            self.postMessage({ type: 'test-results', results });
          `;

          const bundledCode = await bundle(files, entryPoint);
          const fullCode = bundledCode + "\n" + harness;

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
                  eval(e.data.code);
                  self.postMessage({ type: 'done', duration: 0 });
                } catch (err) {
                  self.postMessage({ type: 'log', logType: 'error', content: [err.message] });
                  self.postMessage({ type: 'done', duration: 0 });
                }
              }
            };
          `;

          const blob = new Blob([workerCode], { type: 'application/javascript' });
          const worker = new Worker(URL.createObjectURL(blob));

          return new Promise<{ results: any[] }>((resolve) => {
            worker.onmessage = (e) => {
              if (e.data.type === 'log') {
                onLog(e.data.logType, e.data.content);
              } else if (e.data.type === 'test-results') {
                resolve({ results: e.data.results });
              }
            };

            worker.postMessage({ type: 'execute', code: fullCode });
            
            setTimeout(() => {
                worker.terminate();
                resolve({ results: [] });
            }, 5000);
          });
        } catch (err: any) {
          onLog('error', [err.message]);
          return { results: [] };
        }
    }
    onLog('warn', ['Test execution only supported for JS/TS in this prototype.']);
    return { results: [] };
  }

  stop() {
    jsRunner.stop();
    pyRunner.stop();
  }
}

export const runner = new Runner();