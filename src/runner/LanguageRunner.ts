export interface ExecutionResult {
  stdout: string[];
  stderr: string[];
  duration: number;
  error?: string;
}

export interface ILanguageRunner {
  supports(extension: string): boolean;
  run(
    files: Record<string, string>, 
    entryPoint: string, 
    onLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void,
    onRender?: (code: string) => void
  ): Promise<ExecutionResult>;
}

export class RunnerRegistry {
  private runners: ILanguageRunner[] = [];

  register(runner: ILanguageRunner) {
    this.runners.push(runner);
  }

  getRunner(filename: string): ILanguageRunner | null {
    const ext = filename.split('.').pop() || '';
    return this.runners.find(r => r.supports(ext)) || null;
  }
}

export const registry = new RunnerRegistry();
