import React, { useRef, useEffect, useState } from 'react';
import { useEditor } from '../../store/useEditor';
import { Trash2, ChevronRight, AlertCircle, Info, AlertTriangle, CheckCircle2, Terminal, Plus, X, PanelBottomClose } from 'lucide-react';
import { Shell } from './Shell';
import { v4 as uuidv4 } from 'uuid';

interface TerminalSession {
  id: string;
  name: string;
}

export const ConsoleContainer: React.FC<{ onToggle?: () => void }> = ({ onToggle }) => {
  const { consoleLogs, clearLogs, testResults, setTestResults, theme } = useEditor();
  const [terminals, setTerminals] = useState<TerminalSession[]>([{ id: 'default', name: 'Shell 1' }]);
  const [activeTab, setActiveTab] = useState<string>('output'); // 'output' or terminal ID
  const scrollRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'vs-dark';

  useEffect(() => {
    if (scrollRef.current && activeTab === 'output') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleLogs, testResults, activeTab]);

  const addTerminal = () => {
    const newId = uuidv4();
    setTerminals([...terminals, { id: newId, name: `Shell ${terminals.length + 1}` }]);
    setActiveTab(newId);
  };

  const closeTerminal = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTerminals = terminals.filter(t => t.id !== id);
    setTerminals(newTerminals);
    if (activeTab === id) {
      setActiveTab(newTerminals.length > 0 ? newTerminals[newTerminals.length - 1].id : 'output');
    }
  };

  const formatArg = (arg: unknown) => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle size={14} className="text-red-500" />;
      case 'warn': return <AlertTriangle size={14} className="text-yellow-500" />;
      case 'info': return <Info size={14} className="text-blue-500" />;
      default: return <ChevronRight size={14} className="text-gray-600" />;
    }
  };

  return (
    <div className={`h-full flex flex-col border-t transition-colors ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-[#ddd]'}`}>
      <div className={`h-9 border-b flex items-center justify-between px-4 shrink-0 overflow-x-auto no-scrollbar ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
        <div className="flex items-center h-full">
          {/* Output Tab */}
          <button 
            onClick={() => { setActiveTab('output'); setTestResults(null); }}
            className={`text-[11px] font-bold uppercase tracking-wider transition-colors h-full px-3 flex items-center gap-2 border-r ${isDark ? 'border-[#333]' : 'border-[#ddd]'} ${activeTab === 'output' ? 'text-blue-400 bg-black/10 border-b-2 border-b-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Output
          </button>

          {/* Terminal Tabs */}
          {terminals.map(term => (
            <div 
              key={term.id}
              onClick={() => setActiveTab(term.id)}
              className={`group text-[11px] font-bold uppercase tracking-wider transition-colors h-full px-3 flex items-center gap-2 cursor-pointer border-r ${isDark ? 'border-[#333]' : 'border-[#ddd]'} ${activeTab === term.id ? 'text-blue-400 bg-black/10 border-b-2 border-b-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Terminal size={12} />
              <span>{term.name}</span>
              <button 
                onClick={(e) => closeTerminal(e, term.id)}
                className="opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-500 rounded p-0.5 transition-all"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {/* Add Terminal Button */}
          <button 
            onClick={addTerminal}
            className={`h-full px-2 hover:bg-black/10 transition-colors ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
            title="New Terminal"
          >
            <Plus size={12} />
          </button>

          {testResults && (
            <button 
              onClick={() => setActiveTab('test-results')}
              className={`text-[11px] font-bold uppercase tracking-wider text-blue-400 border-b-2 border-blue-400 h-full px-3 ml-2`}
            >
              Test Results
            </button>
          )}
        </div>
        
        {activeTab === 'output' && (
          <div className="flex items-center gap-1">
            <button 
              onClick={() => {
                clearLogs();
                setTestResults(null);
              }}
              className={`p-1 rounded transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-[#37373d]' : 'text-gray-400 hover:text-black hover:bg-[#e1e1e1]'}`}
              title="Clear Console"
            >
              <Trash2 size={14} />
            </button>
            {onToggle && (
              <button
                onClick={onToggle}
                className={`p-1 rounded transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-[#37373d]' : 'text-gray-400 hover:text-black hover:bg-[#e1e1e1]'}`}
                title="Close Console (Ctrl+`)"
              >
                <PanelBottomClose size={14} />
              </button>
            )}
          </div>
        )}
        {activeTab !== 'output' && onToggle && (
          <button
            onClick={onToggle}
            className={`p-1 rounded transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-[#37373d]' : 'text-gray-400 hover:text-black hover:bg-[#e1e1e1]'}`}
            title="Close Console (Ctrl+`)"
          >
            <PanelBottomClose size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        {/* Render ALL shells but hide inactive ones to preserve state */}
        {terminals.map(term => (
          <div key={term.id} className={`h-full w-full ${activeTab === term.id ? 'block' : 'hidden'}`}>
            <Shell />
          </div>
        ))}

        {activeTab === 'output' && (
          <div 
            ref={scrollRef}
            className={`h-full overflow-y-auto p-2 font-mono text-[13px] selection:bg-blue-600/30 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
          >
            {consoleLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 italic">
                No output to display
              </div>
            ) : (
              consoleLogs.map((log, i) => (
                <div 
                  key={log.timestamp + i}
                  className={`
                    flex gap-3 py-1 px-2 border-b last:border-0
                    ${isDark ? 'border-white/5' : 'border-gray-100'}
                    ${log.type === 'error' ? (isDark ? 'bg-red-500/5 text-red-200' : 'bg-red-50 text-red-700') : ''}
                    ${log.type === 'warn' ? (isDark ? 'bg-yellow-500/5 text-yellow-200' : 'bg-yellow-700/5 text-yellow-700') : ''}
                  `}
                >
                  <div className="mt-1 shrink-0">{getLogIcon(log.type)}</div>
                  <div className="flex-1 whitespace-pre-wrap break-all overflow-hidden leading-relaxed">
                    {log.content.map((arg, j) => (
                      <span key={j} className="mr-2">{formatArg(arg)}</span>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 select-none shrink-0 opacity-50">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'test-results' && testResults && (
           <div className={`h-full overflow-y-auto p-2 font-mono text-[13px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="flex flex-col gap-4 p-2">
                <div className="flex items-center gap-4 mb-2">
                  <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                    Results: {testResults.filter(r => r.passed).length} / {testResults.length} Passed
                  </span>
                  <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}>
                    <div 
                      className="h-full bg-green-500 transition-all" 
                      style={{ width: `${(testResults.filter(r => r.passed).length / testResults.length) * 100}%` }}
                    />
                  </div>
                </div>
                
                {testResults.map((result, i) => (
                  <div key={i} className={`p-3 rounded border ${result.passed 
                    ? (isDark ? 'border-green-900/30 bg-green-900/10' : 'border-green-200 bg-green-50') 
                    : (isDark ? 'border-red-900/30 bg-red-900/10' : 'border-red-200 bg-red-50')}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {result.passed ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
                      <span className={`font-bold ${result.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {result.name}: {result.passed ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                    {!result.passed && (
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div>
                          <div className="text-gray-500 mb-1 italic">Expected:</div>
                          <pre className={`p-2 rounded overflow-x-auto ${isDark ? 'bg-[#111]' : 'bg-white border border-gray-200'}`}>{formatArg(result.expected)}</pre>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1 italic">Actual:</div>
                          <pre className={`p-2 rounded overflow-x-auto ${isDark ? 'bg-[#111]' : 'bg-white border border-gray-200'}`}>{formatArg(result.actual)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
