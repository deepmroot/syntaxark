import React, { useRef, useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { useFileSystem } from '../../store/useFileSystem';
import { useEditor } from '../../store/useEditor';
import { X, Columns, Plus } from 'lucide-react';
import { LANGUAGE_MAP } from '../../data/languages';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileIcon } from '../Explorer/FileIcon';

// Configure Monaco (same as before)
loader.init().then((monaco) => {
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: 'React',
    allowJs: true,
    typeRoots: ['node_modules/@types'],
  });
  
  const reactTypes = `
    declare module 'react' {
      export default any;
      export const useState: any;
      export const useEffect: any;
      export const useRef: any;
    }
    declare module 'react-dom/client' {
      export const createRoot: any;
    }
  `;
  monaco.languages.typescript.typescriptDefaults.addExtraLib(reactTypes, 'file:///node_modules/@types/react/index.d.ts');
});

const EditorPane: React.FC<{
  fileId: string | null;
  isActivePane: boolean;
  onFocus: () => void;
}> = ({ fileId, isActivePane, onFocus }) => {
  const { nodes, updateFileContent, openFileIds, setActiveFile, closeFile, createNode } = useFileSystem();
  const { theme, monacoTheme, editorFont, fontSize, minimap, wordWrap, lineNumbers, bracketPairs, autoComplete, tabSize, smoothScrolling } = useEditor();
  const activeFile = fileId ? nodes[fileId] : null;
  const isDark = theme === 'vs-dark';
  const tabBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fileId || !tabBarRef.current) return;
    const el = tabBarRef.current.querySelector(`[data-tab-id="${fileId}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [fileId]);

  const getLanguage = (extension?: string) => {
    if (!extension) return 'javascript';
    if (LANGUAGE_MAP[extension]) return LANGUAGE_MAP[extension].monacoLanguage;
    switch (extension) {
      case 'json': return 'json';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'md': return 'markdown';
      default: return 'javascript';
    }
  };

  const createExampleFile = () => {
    const ext = 'js';
    const base = 'main';
    const rootNames = new Set(
      Object.values(nodes)
        .filter((n) => n.parentId === null)
        .map((n) => n.name.toLowerCase()),
    );

    let nextName = `${base}.${ext}`;
    let index = 2;
    while (rootNames.has(nextName.toLowerCase())) {
      nextName = `${base}${index}.${ext}`;
      index += 1;
    }

    const content = LANGUAGE_MAP[ext]?.template ?? '';
    const id = createNode(nextName, 'file', null, content);
    setActiveFile(id);
    window.dispatchEvent(new CustomEvent('syntaxark:navigate', { detail: { tab: 'explorer' } }));
  };

  return (
    <div 
      className={`h-full flex flex-col ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'} ${isActivePane ? 'ring-1 ring-blue-500/50 z-10' : ''}`}
      onClick={onFocus}
    >
      {/* Tabs */}
      <div ref={tabBarRef} className={`h-9 shrink-0 flex items-center overflow-x-auto no-scrollbar border-b ${isDark ? 'bg-[#252526] border-[#1e1e1e]' : 'bg-[#f3f3f3] border-[#e1e1e1]'}`}>
        {openFileIds.map(id => {
          const node = nodes[id];
          if (!node) return null;
          
          const isActiveTab = fileId === id;
          
          return (
            <div
              key={id}
              data-tab-id={id}
              onClick={(e) => {
                e.stopPropagation();
                onFocus(); // Ensure pane is active
                setActiveFile(id);
              }}
              className={`
                group flex items-center px-3 h-full cursor-pointer text-xs min-w-[120px] max-w-[200px] border-r transition-colors
                ${isActiveTab 
                  ? (isDark ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500' : 'bg-white text-black border-t-2 border-t-blue-500') 
                  : (isDark ? 'bg-[#2d2d2d] text-gray-500 hover:bg-[#2b2b2b]' : 'bg-[#ececec] text-gray-600 hover:bg-[#f5f5f5]')
                }
                ${isDark ? 'border-[#1e1e1e]' : 'border-[#e1e1e1]'}
              `}
            >
              <FileIcon 
                name={node.name}
                size={14} 
                className="mr-2 shrink-0" 
              />
              <span className="flex-1 truncate">{node.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(id);
                }}
                className={`ml-2 p-0.5 rounded hover:bg-[#454545] transition-opacity ${isActiveTab ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        {activeFile ? (
          <Editor
            height="100%"
            theme={monacoTheme}
            language={getLanguage(activeFile.extension)}
            value={activeFile.content}
            onChange={(value) => updateFileContent(activeFile.id, value || '')}
            onMount={(editor) => {
                editor.onDidFocusEditorText(() => onFocus());
            }}
            options={{
              fontSize,
              minimap: { enabled: minimap },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 16 },
              wordWrap,
              lineNumbers,
              lineNumbersMinChars: 3,
              fontFamily: `'${editorFont}', monospace`,
              fontLigatures: true,
              bracketPairColorization: { enabled: bracketPairs },
              quickSuggestions: autoComplete,
              suggestOnTriggerCharacters: autoComplete,
              parameterHints: { enabled: autoComplete },
              tabSize,
              smoothScrolling,
              cursorSmoothCaretAnimation: smoothScrolling ? 'on' : 'off',
            }}
          />
        ) : (
          <div className={`h-full flex items-center justify-center flex-col gap-4 px-6 text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            <div className={`w-28 h-28 rounded-full flex items-center justify-center border transition-all ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
              <img src="/logo.png" className="w-20 h-20 object-contain opacity-40 grayscale" alt="SyntaxArk" />
            </div>
            <p className="brand-wordmark text-3xl text-white/80">
              <span>Syntax</span>
              <span className="brand-wordmark-accent">Ark</span>
            </p>
            <p className="text-xs font-semibold tracking-wide">
              Create a file and choose a language with the file extension like <code>.js</code>, <code>.ts</code>, or <code>.py</code>.
            </p>
            <button
              onClick={createExampleFile}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
            >
              <Plus size={13} />
              New Example File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const EditorContainer: React.FC = () => {
  const { activeFileId, secondaryFileId, isSplit, activePane, setActivePane, toggleSplit } = useFileSystem();
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';

  return (
    <div className="h-full w-full relative group/container">
      {/* Split Toggle Button (Absolute positioning in top right of container) */}
      <div className="absolute top-1 right-1 z-50">
         <button 
           onClick={toggleSplit}
           className={`p-1.5 rounded shadow-lg transition-colors ${isDark ? 'bg-[#333] text-gray-300 hover:bg-[#444] hover:text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-black'}`}
           title={isSplit ? "Close Split View" : "Split Editor Right"}
         >
           <Columns size={14} />
         </button>
      </div>

      {isSplit ? (
        <Group orientation="horizontal">
          <Panel defaultSize={50} minSize={20}>
            <EditorPane 
              fileId={activeFileId} 
              isActivePane={activePane === 'primary'} 
              onFocus={() => setActivePane('primary')}
            />
          </Panel>
          <Separator className="resize-handle-horizontal" />
          <Panel defaultSize={50} minSize={20}>
            <EditorPane 
              fileId={secondaryFileId || activeFileId} // Default to same file if null
              isActivePane={activePane === 'secondary'} 
              onFocus={() => setActivePane('secondary')}
            />
          </Panel>
        </Group>
      ) : (
        <EditorPane 
          fileId={activeFileId} 
          isActivePane={true} 
          onFocus={() => setActivePane('primary')}
        />
      )}
    </div>
  );
};
