import type { ILanguageRunner, ExecutionResult } from './LanguageRunner';

export class PythonRunner implements ILanguageRunner {
  private worker: Worker | null = null;

  supports(extension: string): boolean {
    return ['py'].includes(extension);
  }

  async run(
    files: Record<string, string>, 
    entryPoint: string, 
    onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void,
    _onRender?: (code: string) => void
  ): Promise<ExecutionResult> {
    if (this.worker) {
      this.worker.terminate();
    }

    const workerCode = `
      importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

      let pyodide = null;

      async function loadPyodideAndRun() {
        if (!pyodide) {
          self.postMessage({ type: 'log', logType: 'info', content: ['Loading Python Engine (Pyodide)...'] });
          pyodide = await loadPyodide();
          await pyodide.loadPackage("micropip");
        }
      }

      self.onmessage = async (e) => {
        const { code, files, entry } = e.data;
        
        try {
          if (!pyodide) await loadPyodideAndRun();

          // Write files to virtual FS
          for (const [name, content] of Object.entries(files)) {
             pyodide.FS.writeFile(name, content);
          }

          // Detect imports to auto-install
          const importRegex = /^(?:from|import) +([\\w-]+)/gm;
          let match;
          const packages = new Set();
          while ((match = importRegex.exec(code)) !== null) {
            const pkg = match[1];
            // Filter out standard library modules if possible, but micropip handles unknown reasonably well
            if (!['sys', 'os', 'math', 'time', 'json', 're'].includes(pkg)) {
               packages.add(pkg);
            }
          }

          if (packages.size > 0) {
            self.postMessage({ type: 'log', logType: 'info', content: [\`Installing packages: \${Array.from(packages).join(', ')}...\`] });
            const micropip = pyodide.pyimport("micropip");
            try {
              await micropip.install(Array.from(packages));
            } catch (err) {
               self.postMessage({ type: 'log', logType: 'warn', content: [\`Package installation warning: \${err.message}\`] });
            }
          }

          // Redirect stdout
          pyodide.setStdout({ batched: (msg) => self.postMessage({ type: 'log', logType: 'log', content: [msg] }) });
          pyodide.setStderr({ batched: (msg) => self.postMessage({ type: 'log', logType: 'error', content: [msg] }) });

          const start = performance.now();
          await pyodide.runPythonAsync(code);
          const end = performance.now();
          
          self.postMessage({ type: 'done', duration: end - start });

        } catch (err) {
          self.postMessage({ type: 'log', logType: 'error', content: [err.message] });
          self.postMessage({ type: 'done', duration: 0 });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));

    return new Promise<ExecutionResult>((resolve) => {
      this.worker!.onmessage = (e) => {
        if (e.data.type === 'log') {
          onLog(e.data.logType, e.data.content);
        } else if (e.data.type === 'done') {
          resolve({ duration: e.data.duration, stdout: [], stderr: [] });
        }
      };

      const code = files[entryPoint];
      this.worker!.postMessage({ code, files, entry: entryPoint });

      // Longer timeout for ML installs
      setTimeout(() => {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
          onLog('error', ['Execution timed out (Installing libraries like numpy/pandas takes time on first run)']);
          resolve({ duration: 30000, stdout: [], stderr: ['Timeout'], error: 'Timeout' });
        }
      }, 60000); // 60s timeout
    });
  }

  stop() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}