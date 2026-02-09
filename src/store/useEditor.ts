import { create } from 'zustand';

interface ConsoleLog {
  type: 'log' | 'error' | 'warn' | 'info';
  content: any[];
  timestamp: number;
}

interface TestResult {
  name: string;
  passed: boolean;
  actual: any;
  expected: any;
}

interface EditorState {
  consoleLogs: ConsoleLog[];
  testResults: TestResult[] | null;
  previewCode: string | null;
  isExecuting: boolean;
  executionTime: number | null;
  theme: 'vs-dark' | 'light';
  monacoTheme: string;
  editorFont: string;
  fontSize: number;
  minimap: boolean;
  wordWrap: 'on' | 'off';
  lineNumbers: 'on' | 'off';
  bracketPairs: boolean;
  autoComplete: boolean;
  tabSize: number;
  smoothScrolling: boolean;
  addLog: (type: 'log' | 'error' | 'warn' | 'info', content: any[]) => void;
  clearLogs: () => void;
  setTestResults: (results: TestResult[] | null) => void;
  setPreviewCode: (code: string | null) => void;
  setExecuting: (isExecuting: boolean) => void;
  setExecutionTime: (time: number | null) => void;
  setTheme: (theme: 'vs-dark' | 'light') => void;
  setMonacoTheme: (theme: string) => void;
  setEditorFont: (font: string) => void;
  setFontSize: (size: number) => void;
  setMinimap: (enabled: boolean) => void;
  setWordWrap: (wrap: 'on' | 'off') => void;
  setLineNumbers: (show: 'on' | 'off') => void;
  setBracketPairs: (enabled: boolean) => void;
  setAutoComplete: (enabled: boolean) => void;
  setTabSize: (size: number) => void;
  setSmoothScrolling: (enabled: boolean) => void;
}

export const useEditor = create<EditorState>((set) => ({
  consoleLogs: [],
  testResults: null,
  previewCode: null,
  isExecuting: false,
  executionTime: null,
  theme: 'vs-dark',
  monacoTheme: 'vs-dark',
  editorFont: 'JetBrains Mono',
  fontSize: 14,
  minimap: true,
  wordWrap: 'on' as const,
  lineNumbers: 'on' as const,
  bracketPairs: true,
  autoComplete: true,
  tabSize: 2,
  smoothScrolling: true,

  addLog: (type, content) => set((state) => ({
    consoleLogs: [...state.consoleLogs, { type, content, timestamp: Date.now() }]
  })),

  clearLogs: () => set({ consoleLogs: [] }),

  setTestResults: (results) => set({ testResults: results }),
  
  setPreviewCode: (code) => set({ previewCode: code }),

  setExecuting: (isExecuting) => set({ isExecuting }),

  setExecutionTime: (time) => set({ executionTime: time }),

  setTheme: (theme) => set({ theme, monacoTheme: theme === 'vs-dark' ? 'vs-dark' : 'light' }),

  setMonacoTheme: (theme) => set({ monacoTheme: theme }),

  setEditorFont: (font) => set({ editorFont: font }),

  setFontSize: (size) => set({ fontSize: size }),
  setMinimap: (enabled) => set({ minimap: enabled }),
  setWordWrap: (wrap) => set({ wordWrap: wrap }),
  setLineNumbers: (show) => set({ lineNumbers: show }),
  setBracketPairs: (enabled) => set({ bracketPairs: enabled }),
  setAutoComplete: (enabled) => set({ autoComplete: enabled }),
  setTabSize: (size) => set({ tabSize: size }),
  setSmoothScrolling: (enabled) => set({ smoothScrolling: enabled }),
}));
