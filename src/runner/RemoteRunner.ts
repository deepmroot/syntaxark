import type { ILanguageRunner, ExecutionResult } from './LanguageRunner';
import { LANGUAGE_MAP } from '../data/languages';

export class RemoteRunner implements ILanguageRunner {
  private sqlJsInitPromise: Promise<any> | null = null;

  private withRustDependencyHint(extension: string, stderr: string): string {
    if (extension !== 'rs') return stderr;
    const missingCrate =
      /unresolved import|undeclared crate|can't find crate|failed to resolve: use of undeclared crate/i.test(stderr);
    if (!missingCrate) return stderr;
    const hint =
      '\n\nHint: Remote Rust execution uses single-file rustc (no Cargo.toml), so external crates (for example `rand`) are not available.';
    return stderr.includes('single-file rustc') ? stderr : `${stderr}${hint}`;
  }

  private async getSqlJs() {
    if (!this.sqlJsInitPromise) {
      this.sqlJsInitPromise = (async () => {
        const sqlJsUrl = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js';
        const wasmUrl = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.wasm';
        const mod: any = await import(/* @vite-ignore */ sqlJsUrl);
        const globalInit = (globalThis as any).initSqlJs;
        const init = mod?.default || mod?.initSqlJs || globalInit;
        if (typeof init !== 'function') {
          throw new Error('sql.js initializer not found');
        }
        return await init({ locateFile: () => wasmUrl });
      })();
    }
    return this.sqlJsInitPromise;
  }

  private parseSqlStatements(source: string): string[] {
    return source
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private async runSqlLocal(
    source: string,
    onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void,
  ): Promise<ExecutionResult> {
    onLog('info', ['SQL_MODE:local']);
    onLog('info', ['SQL mode: Local SQLite']);
    const SQL = await this.getSqlJs();
    const db = new SQL.Database();
    const start = performance.now();
    const statements = this.parseSqlStatements(source);
    const stdout: string[] = [];

    statements.forEach((statement, idx) => {
      const queryIndex = idx + 1;
      const results = db.exec(statement);
      if (results.length === 0) {
        const msg = `Query ${queryIndex}: OK`;
        stdout.push(msg);
        onLog('info', [msg]);
        return;
      }
      results.forEach((result: any) => {
        const rows = result.values.map((vals: any[]) =>
          Object.fromEntries(result.columns.map((col: string, i: number) => [col, vals[i]])),
        );
        const output = JSON.stringify(rows, null, 2);
        stdout.push(output);
        onLog('log', [output]);
      });
    });

    db.close();
    return { stdout, stderr: [], duration: performance.now() - start };
  }

  private async runSqlRemoteFallback(
    source: string,
    onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void,
  ): Promise<ExecutionResult> {
    onLog('info', ['SQL_MODE:remote']);
    onLog('info', ['SQL mode: Remote Fallback']);
    const pythonScript = `import sqlite3, json\nsql = r'''${source.replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'")}'''\nconn = sqlite3.connect(':memory:')\ncur = conn.cursor()\nparts=[s.strip() for s in sql.split(';') if s.strip()]\nout=[]\nfor i,s in enumerate(parts, start=1):\n  try:\n    cur.execute(s)\n    if cur.description:\n      cols=[d[0] for d in cur.description]\n      rows=[dict(zip(cols,row)) for row in cur.fetchall()]\n      out.append({'query':i,'rows':rows})\n    else:\n      conn.commit()\n      out.append({'query':i,'ok':True})\n  except Exception as e:\n    out.append({'query':i,'error':str(e)})\nprint(json.dumps(out))\n`;

    const start = performance.now();
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        version: '3.10.0',
        files: [{ name: 'main.py', content: pythonScript }],
      }),
    });
    const result = await response.json();
    const end = performance.now();
    const run = result?.run;
    if (!run) return { stdout: [], stderr: ['Invalid SQL fallback response'], duration: end - start, error: 'Invalid response' };
    if (run.stdout) onLog('log', [run.stdout]);
    if (run.stderr) onLog('error', [run.stderr]);
    return {
      stdout: run.stdout ? [run.stdout] : [],
      stderr: run.stderr ? [run.stderr] : [],
      duration: end - start,
      error: run.code !== 0 ? 'SQL fallback execution failed' : undefined,
    };
  }

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
    const source = files[entryPoint] || '';
    let sourceToRun = source;

    if (extension === 'sql') {
      onLog('info', ['Running SQL in hybrid mode (local SQLite, remote fallback)...']);
      try {
        return await this.runSqlLocal(source, onLog);
      } catch (err: any) {
        onLog('warn', [`Local SQL engine unavailable: ${err.message}. Falling back to remote SQL.`]);
        try {
          return await this.runSqlRemoteFallback(source, onLog);
        } catch (fallbackErr: any) {
          onLog('error', [`SQL fallback failed: ${fallbackErr.message}`]);
          return { stdout: [], stderr: [fallbackErr.message], duration: 0, error: fallbackErr.message };
        }
      }
    }

    if (!config) {
      return { stdout: [], stderr: ['Unsupported language'], duration: 0, error: 'Unsupported' };
    }

    if (extension === 'java' && !/static\s+void\s+main\s*\(/.test(source)) {
      onLog('warn', ['No main(String[]) found. Injecting fallback main. For challenge problems, use Run/Run Tests in challenge mode.']);
      sourceToRun = `${source}

class Main {
  public static void main(String[] args) {
    System.out.println("Compiled successfully. Use Run Tests for challenge validation.");
  }
}
`;
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
              content: sourceToRun
            }
          ]
        })
      });

      const result = await response.json();
      const end = performance.now();

      if (result.run) {
        const normalizedStderr = result.run.stderr
          ? this.withRustDependencyHint(extension, result.run.stderr)
          : '';
        if (result.run.stdout) onLog('log', [result.run.stdout]);
        if (normalizedStderr) onLog('error', [normalizedStderr]);
        
        return {
          stdout: result.run.stdout ? [result.run.stdout] : [],
          stderr: normalizedStderr ? [normalizedStderr] : [],
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
