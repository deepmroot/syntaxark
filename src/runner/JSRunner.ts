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
              // Simple heuristic: check for 'react-dom', 'document', or jQuery symbols
              if (
                e.data.code.includes('react-dom') || 
                e.data.code.includes('document.') ||
                e.data.code.includes('window.') ||
                e.data.code.includes('$.') || 
                e.data.code.includes('$("') || 
                e.data.code.includes("$('") ||
                e.data.code.includes('jQuery')
              ) {
                 const html = \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; line-height: 1.5; }
    #root, #app { min-height: 100px; }
  </style>
  <script>
    (function() {
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (typeof url === 'string' && url.includes('server_echo.php')) {
          const params = new URLSearchParams(url.split('?')[1]);
          const msg = params.get('message') || 'No message';
          return new Response(msg, { status: 200 });
        }
        return originalFetch(url, options);
      };

      // Mock jQuery's $.get if it's used
      const mockJQuery = () => {
        if (window.jQuery) {
          const originalGet = window.jQuery.get;
          window.jQuery.get = function(url, data, success) {
            if (typeof url === 'string' && url.includes('server_echo.php')) {
              const msg = (data && data.message) ? data.message : 'No message';
              if (typeof success === 'function') success(msg);
              return {
                done: (cb) => { if (typeof cb === 'function') cb(msg); return this; },
                fail: () => { return this; }
              };
            }
            return originalGet.apply(this, arguments);
          };
        } else {
          setTimeout(mockJQuery, 10);
        }
      };
      mockJQuery();
    })();
  <\\/script>
</head>
<body>
  <div id="app"></div>
  <div id="root"></div>
  <script>\\\${e.data.code}<\\/script>
</body>
</html>\`;
                 self.postMessage({ type: 'render', code: html });
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
