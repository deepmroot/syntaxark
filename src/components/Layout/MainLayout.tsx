import React, { useState, useEffect, useRef } from 'react';
import { Panel, Group, Separator, type PanelImperativeHandle } from 'react-resizable-panels';
import { Sidebar } from '../Explorer/Sidebar';
import { EditorContainer } from '../Editor/EditorContainer';
import { ConsoleContainer } from '../Console/ConsoleContainer';
import { useEditor } from '../../store/useEditor';
import { Play, Square, Trophy, CheckCircle2, Files, Settings as SettingsIcon, Search as SearchIcon, Terminal as TerminalIcon, Sun, Moon, PenTool, Keyboard, Download, Share2, Copy, Mail, Link2, Minimize2, Users2, Globe, UserCircle } from 'lucide-react';
import { createZipBlob } from '../../utils/zip';
import { DrawingCanvas } from '../Drawing/DrawingCanvas';
import { runner } from '../../runner/Runner';
import { useFileSystem } from '../../store/useFileSystem';
import { ChallengesPanel } from '../Challenges/ChallengesPanel';
import { CollaboratePanel } from '../Collaborate/CollaboratePanel';
import { CommunityPanel, CreatePostModal } from '../Community/CommunityPanel';
import { AuthModal } from '../Profile/AuthModal';
import { UserProfileModal } from '../Profile/UserProfileModal';
import { Search } from '../Explorer/Search';
import { Settings } from '../Explorer/Settings';
import { PreviewPanel } from './PreviewPanel';
import { CHALLENGES } from '../../data/challenges';
import { useAuth } from '../../store/useAuth';
import { useCommunity } from '../../store/useCommunity';

type SidebarTab = 'explorer' | 'challenges' | 'collaborate' | 'community' | 'search' | 'settings';

export const MainLayout: React.FC = () => {
  const { isExecuting, setExecuting, addLog, clearLogs, setExecutionTime, executionTime, setTestResults, setPreviewCode, previewCode, theme, setTheme } = useEditor();
  const { nodes, activeFileId } = useFileSystem();
  const { user, showAuth, setShowAuth, showProfile, setShowProfile } = useAuth();
  const { showCreatePost, setShowCreatePost } = useCommunity();
  
  const [activeTab, setActiveTab] = useState<SidebarTab>('explorer');
  const [showDrawing, setShowDrawing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showConsole, setShowConsole] = useState(true);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [fullscreenDrawing, setFullscreenDrawing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const consolePanelRef = useRef<PanelImperativeHandle>(null);

  const isDark = theme === 'vs-dark';

  const renderSidebarContent = () => {
    switch (activeTab) {
      case 'explorer': return <Sidebar />;
      case 'challenges': return <ChallengesPanel />;
      case 'collaborate': return <CollaboratePanel />;
      case 'community': return <CommunityPanel />;
      case 'search': return <Search />;
      case 'settings': return <Settings />;
      default: return <Sidebar />;
    }
  };

  const handleTabClick = (tab: SidebarTab) => {
    if (activeTab === tab && showSidebar) {
      setShowSidebar(false);
    } else {
      setActiveTab(tab);
      setShowSidebar(true);
    }
  };

  const activeNode = activeFileId ? nodes[activeFileId] : null;
  const activeChallenge = activeNode?.challengeId 
    ? CHALLENGES.find(c => c.id === activeNode.challengeId) 
    : null;
  const isChallenge = !!activeChallenge;

  const handleRun = async () => {
    if (!activeFileId) return;
    clearLogs();
    setTestResults(null);
    setPreviewCode(null);
    setExecuting(true);
    setExecutionTime(null);
    const files: Record<string, string> = {};
    Object.values(nodes).forEach(node => { if (node.type === 'file') files[node.name] = node.content || ''; });
    const activeFile = nodes[activeFileId];
    
    const result = await runner.run(
      files, 
      activeFile.name, 
      (type, content) => addLog(type as any, content),
      (code) => setPreviewCode(code)
    );
    
    setExecutionTime(result.duration);
    setExecuting(false);
  };

  const handleRunTests = async () => {
    if (!activeFileId || !activeNode?.challengeId) return;
    const challenge = CHALLENGES.find(c => c.id === activeNode.challengeId);
    if (!challenge) return;
    clearLogs();
    setTestResults(null);
    setExecuting(true);
    const files: Record<string, string> = {};
    Object.values(nodes).forEach(node => { if (node.type === 'file') files[node.name] = node.content || ''; });
    const result = await runner.runTests(files, activeNode.name, challenge.testCases, (type, content) => { addLog(type as any, content); });
    setTestResults(result.results);
    setExecuting(false);
  };

  /* ── download helpers ── */
  const buildPath = (nodeId: string): string => {
    const node = nodes[nodeId];
    if (!node) return '';
    if (!node.parentId) return node.name;
    return buildPath(node.parentId) + '/' + node.name;
  };

  const downloadCurrentFile = () => {
    if (!activeFileId || !activeNode) return;
    const blob = new Blob([activeNode.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeNode.name;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  const downloadAllAsZip = () => {
    const files: { path: string; content: string }[] = [];
    Object.values(nodes).forEach(node => {
      if (node.type === 'file') {
        files.push({ path: buildPath(node.id), content: node.content || '' });
      }
    });
    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'syntaxark-project.zip';
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  /* ── share helpers ── */
  const flash = (msg: string) => { setCopyFeedback(msg); setTimeout(() => setCopyFeedback(''), 2000); };

  const copyCurrentFile = async () => {
    if (!activeNode) return;
    await navigator.clipboard.writeText(activeNode.content || '');
    flash('Copied current file!');
  };

  const copyAllFiles = async () => {
    const text = Object.values(nodes)
      .filter(n => n.type === 'file')
      .map(n => `// ── ${buildPath(n.id)} ──\n${n.content || ''}`)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    flash('Copied all files!');
  };

  const generateShareLink = async () => {
    try {
      const payload: Record<string, string> = {};
      Object.values(nodes).forEach(n => { if (n.type === 'file') payload[buildPath(n.id)] = n.content || ''; });
      const json = JSON.stringify(payload);
      const compressed = btoa(unescape(encodeURIComponent(json)));
      const url = `${window.location.origin}${window.location.pathname}#code=${compressed}`;
      if (url.length > 8000) {
        flash('Project too large for URL — use email or download instead');
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('Shareable link copied!');
    } catch {
      flash('Failed to generate link');
    }
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Check out my SyntaxArk code');
    let body = '';
    if (activeNode) {
      body = encodeURIComponent(`Here's what I'm working on in SyntaxArk:\n\n// ${activeNode.name}\n${(activeNode.content || '').slice(0, 1500)}\n\n— Shared from SyntaxArk`);
    } else {
      body = encodeURIComponent('Check out my code on SyntaxArk!\n\n— Shared from SyntaxArk');
    }
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    setShowShareModal(false);
  };

  const shareViaWebShare = async () => {
    try {
      await navigator.share({
        title: 'SyntaxArk Code',
        text: activeNode ? `// ${activeNode.name}\n${(activeNode.content || '').slice(0, 500)}` : 'Check out my SyntaxArk code',
        url: window.location.href,
      });
      setShowShareModal(false);
    } catch { /* user cancelled */ }
  };

  /* ── keyboard shortcuts ── */
  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;
  const handleRunTestsRef = useRef(handleRunTests);
  handleRunTestsRef.current = handleRunTests;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;
      if (ctrl && key === 'Enter' && !shift) { e.preventDefault(); e.stopPropagation(); handleRunRef.current(); return; }
      if (ctrl && key === 'Enter' && shift) { e.preventDefault(); e.stopPropagation(); handleRunTestsRef.current(); return; }
      if (ctrl && key.toLowerCase() === 'b' && !shift) { e.preventDefault(); e.stopPropagation(); setShowSidebar(s => !s); return; }
      if (ctrl && key === ',') { e.preventDefault(); e.stopPropagation(); setActiveTab('settings'); setShowSidebar(true); return; }
      if (ctrl && shift && key.toLowerCase() === 'f') { e.preventDefault(); e.stopPropagation(); setActiveTab('search'); setShowSidebar(true); return; }
      if (ctrl && shift && key.toLowerCase() === 'e') { e.preventDefault(); e.stopPropagation(); setActiveTab('explorer'); setShowSidebar(true); return; }
      if (ctrl && shift && key.toLowerCase() === 'd') { e.preventDefault(); e.stopPropagation(); setShowDrawing(d => !d); return; }
      if (ctrl && key === '\\') { e.preventDefault(); e.stopPropagation(); useFileSystem.getState().toggleSplit(); return; }
      if (ctrl && key.toLowerCase() === 's' && !shift) { e.preventDefault(); e.stopPropagation(); return; }
      if (ctrl && shift && key.toLowerCase() === 'p') { e.preventDefault(); e.stopPropagation(); setShowShortcuts(s => !s); return; }
      if (ctrl && key === '`') { e.preventDefault(); e.stopPropagation(); const p = consolePanelRef.current; if (p) { p.isCollapsed() ? p.expand() : p.collapse(); } else { setShowConsole(s => !s); } return; }
      if (ctrl && key.toLowerCase() === 't' && !shift) { e.preventDefault(); e.stopPropagation(); const p = consolePanelRef.current; if (p) { p.isCollapsed() ? p.expand() : p.collapse(); } else { setShowConsole(s => !s); } return; }
      if (key === 'Escape') { setShowShortcuts(false); setShowDownloadMenu(false); setShowShareModal(false); if (fullscreenDrawing) setFullscreenDrawing(false); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#1e1e1e] text-gray-300' : 'bg-white text-gray-800'} overflow-hidden font-sans transition-colors duration-200`}>
      {/* Header */}
      <header className={`h-12 border-b flex items-center justify-between px-4 shrink-0 z-50 ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
        <div className="flex items-center gap-3 relative h-full">
          <div className="flex items-center justify-center w-10 h-10 shrink-0">
            <img 
              src="/logo.png" 
              className="w-20 h-20 min-w-[80px] min-h-[60px] object-contain drop-shadow-md z-50 transform hover:scale-110 transition-transform duration-200" 
              alt="SyntaxArk" 
            />
          </div>
          <span className={`font-bold text-xl tracking-tight opacity-90 -ml-1 -mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>SyntaxArk</span>
        </div>

        <div className="flex items-center gap-4">
          {executionTime !== null && (
            <span className="text-[10px] text-gray-500 font-mono">
              {executionTime.toFixed(2)}ms
            </span>
          )}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setTheme(isDark ? 'light' : 'vs-dark')}
              className={`p-1.5 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#3e3e42]' : 'text-gray-600 hover:text-black hover:bg-[#e1e1e1]'}`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Download dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(m => !m)}
                className={`p-1.5 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#3e3e42]' : 'text-gray-600 hover:text-black hover:bg-[#e1e1e1]'}`}
                title="Download Code"
              >
                <Download size={16} />
              </button>
              {showDownloadMenu && (
                <>
                  <div className="fixed inset-0 z-[99]" onClick={() => setShowDownloadMenu(false)} />
                  <div className={`absolute right-0 top-full mt-1 z-[100] w-52 rounded-lg shadow-xl border overflow-hidden ${isDark ? 'bg-[#252526] border-[#444]' : 'bg-white border-[#ddd]'}`}>
                    <button
                      onClick={downloadCurrentFile}
                      disabled={!activeFileId}
                      className={`w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 disabled:opacity-40 transition-colors ${isDark ? 'hover:bg-[#2d2d2d] text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                    >
                      Current File
                      {activeNode && <span className={`ml-auto text-[10px] font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{activeNode.name}</span>}
                    </button>
                    <div className={`h-px ${isDark ? 'bg-[#333]' : 'bg-[#eee]'}`} />
                    <button
                      onClick={downloadAllAsZip}
                      className={`w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 transition-colors ${isDark ? 'hover:bg-[#2d2d2d] text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                    >
                      All Files (.zip)
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Share button */}
            <button
              onClick={() => setShowShareModal(true)}
              className={`p-1.5 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#3e3e42]' : 'text-gray-600 hover:text-black hover:bg-[#e1e1e1]'}`}
              title="Share Code"
            >
              <Share2 size={16} />
            </button>

            <div className={`w-[1px] h-4 mx-1 ${isDark ? 'bg-[#333]' : 'bg-[#ddd]'}`} />

            {isChallenge && (
              <button 
                onClick={handleRunTests}
                disabled={isExecuting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded text-[11px] font-medium transition-colors"
              >
                <CheckCircle2 size={12} /> Run Tests
              </button>
            )}
            <button 
              onClick={isExecuting ? () => runner.stop() : handleRun}
              className={`flex items-center gap-2 px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                isExecuting ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              {isExecuting ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
              {isExecuting ? 'Stop' : 'Run'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Activity Bar */}
        <aside className={`w-12 flex flex-col items-center py-4 gap-4 border-r shrink-0 ${isDark ? 'bg-[#333333] border-[#111]' : 'bg-[#2c2c2c] border-[#ddd]'}`}>
          <button 
            onClick={() => handleTabClick('explorer')}
            className={`p-2 transition-colors relative ${activeTab === 'explorer' && showSidebar ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Explorer (Ctrl+Shift+E)"
          >
            <Files size={24} strokeWidth={1.5} />
            {activeTab === 'explorer' && showSidebar && <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-white" />}
          </button>

          <button 
            onClick={() => handleTabClick('challenges')}
            className={`p-2 transition-colors relative ${activeTab === 'challenges' && showSidebar ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Challenges"
          >
            <Trophy size={24} strokeWidth={1.5} />
            {activeTab === 'challenges' && showSidebar && <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-white" />}
          </button>
          
          <button 
            onClick={() => setShowDrawing(!showDrawing)}
            className={`p-2 transition-colors relative ${showDrawing ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Drawing Board (Ctrl+Shift+D)"
          >
            <PenTool size={24} strokeWidth={1.5} />
            {showDrawing && <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-white" />}
          </button>

          <button 
            onClick={() => handleTabClick('collaborate')}
            className={`p-2 transition-colors relative ${activeTab === 'collaborate' && showSidebar ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Collaborate"
          >
            <Users2 size={24} strokeWidth={1.5} />
            {activeTab === 'collaborate' && showSidebar && <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-white" />}
          </button>

          <button 
            onClick={() => handleTabClick('community')}
            className={`p-2 transition-colors relative ${activeTab === 'community' && showSidebar ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Community"
          >
            <Globe size={24} strokeWidth={1.5} />
            {activeTab === 'community' && showSidebar && <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-white" />}
          </button>


          <button 
            onClick={() => handleTabClick('search')}
            className={`p-2 transition-colors relative ${activeTab === 'search' && showSidebar ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Search (Ctrl+Shift+F)"
          >
            <SearchIcon size={24} strokeWidth={1.5} />
            {activeTab === 'search' && showSidebar && <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-white" />}
          </button>

          <div className="mt-auto flex flex-col gap-4 mb-2 items-center">
             {user ? (
                <button 
                  onClick={() => setShowProfile(true)}
                  className={`p-2 transition-colors relative rounded-full overflow-hidden ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-[#3e3e42]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                  title={user.username}
                >
                  <img src={user.avatar} className="w-8 h-8 rounded-full border-2 border-blue-500 shadow-md" alt="User" />
                </button>
             ) : (
                <button 
                  onClick={() => setShowAuth(true)}
                  className={`p-2 transition-colors relative rounded-full overflow-hidden ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-[#3e3e42]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                  title="Sign In"
                >
                  <UserCircle size={24} strokeWidth={1.5} />
                </button>
             )}

             <button 
                onClick={() => handleTabClick('settings')}
                className={`p-2 transition-colors relative ${activeTab === 'settings' && showSidebar ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-[#3e3e42]'}`}
                title="Settings (Ctrl+,)"
             >
                <SettingsIcon size={24} strokeWidth={1.5} />
                {activeTab === 'settings' && showSidebar && <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-white" />}
             </button>
          </div>

        </aside>

        {/* Resizable Panels */}
        <Group orientation="horizontal" className="flex-1">
          {showSidebar && (
            <>
              <Panel id="sidebar-panel" defaultSize={20} minSize={5}>
                <div className={`h-full w-full ${isDark ? 'bg-[#252526]' : 'bg-[#f3f3f3]'}`}>
                  {renderSidebarContent()}
                </div>
              </Panel>
              <Separator className="resize-handle-horizontal" />
            </>
          )}
          
          {activeChallenge ? (
            <>
              <Panel id="challenge-panel" defaultSize={20} minSize={5}>
                <div className={`h-full w-full flex flex-col border-r overflow-y-auto p-4 custom-scrollbar ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-[#ddd]'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={16} className="text-yellow-500" />
                    <h2 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>{activeChallenge.title}</h2>
                  </div>
                  <p className={`leading-relaxed text-[13px] whitespace-pre-wrap mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {activeChallenge.description}
                  </p>
                  <div className="space-y-3">
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest border-b pb-1 ${isDark ? 'text-gray-500 border-[#333]' : 'text-gray-400 border-[#eee]'}`}>Test Cases</h3>
                    {activeChallenge.testCases.map((tc: any, i: number) => (
                      <div key={i} className={`p-2 rounded text-[10px] font-mono border ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-[#f9f9f9] border-[#eee]'}`}>
                        <div className="text-blue-400 mb-1 flex justify-between">
                           <span>Input:</span>
                           <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{JSON.stringify(tc.input)}</span>
                        </div>
                        <div className="text-green-400 flex justify-between">
                           <span>Expected:</span>
                           <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{JSON.stringify(tc.expected)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
              <Separator className="resize-handle-horizontal" />
              <Panel id="editor-panel-with-challenge" defaultSize={showDrawing ? 40 : 60} minSize={20}>
                <Group orientation="vertical">
                   <Panel id="editor-top" defaultSize={70} minSize={30}>
                     <div className="h-full flex flex-col">
                       <div className="flex-1 min-h-0"><EditorContainer /></div>
                       {!showConsole && (
                         <button
                           onClick={() => consolePanelRef.current?.expand()}
                           className={`h-7 shrink-0 flex items-center gap-2 px-3 text-[11px] font-medium border-t cursor-pointer transition-colors ${isDark ? 'bg-[#1e1e1e] border-[#333] text-gray-400 hover:text-white hover:bg-[#252526]' : 'bg-[#f3f3f3] border-[#ddd] text-gray-600 hover:text-black hover:bg-[#e8e8e8]'}`}
                         >
                           <TerminalIcon size={12} /> Console
                           <kbd className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono ${isDark ? 'bg-[#333] border-[#555] text-gray-500' : 'bg-white border-gray-300 text-gray-400'} border`}>Ctrl+T</kbd>
                         </button>
                       )}
                     </div>
                   </Panel>
                   <Separator className="resize-handle-vertical" />
                   <Panel
                     panelRef={consolePanelRef}
                     id="console-bottom"
                     defaultSize={showConsole ? 30 : 0}
                     minSize={10}
                     collapsible
                     collapsedSize={0}
                     onResize={(size) => setShowConsole(size.asPercentage > 0.5)}
                   >
                     <ConsoleContainer onToggle={() => consolePanelRef.current?.collapse()} />
                   </Panel>
                </Group>
              </Panel>
              {showDrawing && (
                <>
                  <Separator className="resize-handle-horizontal" />
                  <Panel id="drawing-panel-challenge" defaultSize={30} minSize={15}>
                    <DrawingCanvas onClose={() => setShowDrawing(false)} isFullscreen={fullscreenDrawing} onFullscreen={() => setFullscreenDrawing(f => !f)} />
                  </Panel>
                </>
              )}
              {previewCode && (
                <>
                  <Separator className="resize-handle-horizontal" />
                  <Panel id="preview-panel-challenge" defaultSize={30} minSize={15}>
                    <PreviewPanel isDark={isDark} />
                  </Panel>
                </>
              )}
            </>
          ) : (
            <>
              <Panel id="editor-panel-main" defaultSize={showDrawing || previewCode ? 50 : 80} minSize={20}>
                <Group orientation="vertical">
                   <Panel id="editor-top-no-challenge" defaultSize={70} minSize={30}>
                     <div className="h-full flex flex-col">
                       <div className="flex-1 min-h-0"><EditorContainer /></div>
                       {!showConsole && (
                         <button
                           onClick={() => consolePanelRef.current?.expand()}
                           className={`h-7 shrink-0 flex items-center gap-2 px-3 text-[11px] font-medium border-t cursor-pointer transition-colors ${isDark ? 'bg-[#1e1e1e] border-[#333] text-gray-400 hover:text-white hover:bg-[#252526]' : 'bg-[#f3f3f3] border-[#ddd] text-gray-600 hover:text-black hover:bg-[#e8e8e8]'}`}
                         >
                           <TerminalIcon size={12} /> Console
                           <kbd className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono ${isDark ? 'bg-[#333] border-[#555] text-gray-500' : 'bg-white border-gray-300 text-gray-400'} border`}>Ctrl+T</kbd>
                         </button>
                       )}
                     </div>
                   </Panel>
                   <Separator className="resize-handle-vertical" />
                   <Panel
                     panelRef={consolePanelRef}
                     id="console-bottom-no-challenge"
                     defaultSize={showConsole ? 30 : 0}
                     minSize={10}
                     collapsible
                     collapsedSize={0}
                     onResize={(size) => setShowConsole(size.asPercentage > 0.5)}
                   >
                     <ConsoleContainer onToggle={() => consolePanelRef.current?.collapse()} />
                   </Panel>
                </Group>
              </Panel>
              {showDrawing && (
                <>
                  <Separator className="resize-handle-horizontal" />
                  <Panel id="drawing-panel-main" defaultSize={35} minSize={15}>
                    <DrawingCanvas onClose={() => setShowDrawing(false)} isFullscreen={fullscreenDrawing} onFullscreen={() => setFullscreenDrawing(f => !f)} />
                  </Panel>
                </>
              )}
              {previewCode && (
                <>
                  <Separator className="resize-handle-horizontal" />
                  <Panel id="preview-panel-main" defaultSize={35} minSize={15}>
                    <PreviewPanel isDark={isDark} />
                  </Panel>
                </>
              )}
            </>
          )}
        </Group>
      </div>
      
      {/* Status Bar */}
      <footer className={`h-5 flex items-center px-3 text-[10px] justify-between shrink-0 ${isDark ? 'bg-[#007acc] text-white' : 'bg-[#007acc] text-white'}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1"><TerminalIcon size={10} /> Ready</div>
          <button
            onClick={() => { const p = consolePanelRef.current; if (p) { p.isCollapsed() ? p.expand() : p.collapse(); } else { setShowConsole(s => !s); } }}
            className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
            title="Toggle Console (Ctrl+`)"
          >
            <TerminalIcon size={10} /> {showConsole ? 'Hide Console' : 'Show Console'}
          </button>
          {activeFileId && <div className="opacity-80 tracking-wide">{nodes[activeFileId]?.name}</div>}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowShortcuts(s => !s)} className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity" title="Keyboard Shortcuts (Ctrl+Shift+P)">
            <Keyboard size={10} /> Shortcuts
          </button>
          <span>UTF-8</span>
          <span>{activeFileId ? (nodes[activeFileId]?.extension || 'txt').toUpperCase() : 'Plain Text'}</span>
        </div>
      </footer>

      {showShortcuts && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowShortcuts(false)}>
          <div className={`w-[480px] max-h-[70vh] rounded-lg shadow-2xl border overflow-hidden ${isDark ? 'bg-[#252526] border-[#444]' : 'bg-white border-[#ddd]'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-[#333]' : 'border-[#eee]'}`}>
              <div className="flex items-center gap-2">
                <Keyboard size={16} className="text-blue-400" />
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Keyboard Shortcuts</span>
              </div>
              <button onClick={() => setShowShortcuts(false)} className={`p-1 rounded text-lg leading-none ${isDark ? 'hover:bg-[#3e3e42] text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}>×</button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-3 space-y-1">
              {[
                ['Ctrl + Enter', 'Run Code'],
                ['Ctrl + Shift + Enter', 'Run Tests'],
                ['Ctrl + B', 'Toggle Sidebar'],
                ['Ctrl + ,', 'Open Settings'],
                ['Ctrl + Shift + F', 'Search Files'],
                ['Ctrl + Shift + E', 'Explorer'],
                ['Ctrl + Shift + D', 'Toggle Drawing Board'],
                ['Ctrl + \\', 'Toggle Split Editor'],
                ['Ctrl + `', 'Toggle Console'],
                ['Ctrl + T', 'Toggle Console'],
                ['Ctrl + S', 'Save (auto-saved)'],
                ['Ctrl + Shift + P', 'Show / Hide This Panel'],
                ['Escape', 'Close Dialogs'],
              ].map(([keys, action]) => (
                <div key={keys} className={`flex items-center justify-between py-2 px-3 rounded ${isDark ? 'hover:bg-[#2d2d2d]' : 'hover:bg-gray-100'}`}>
                  <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{action}</span>
                  <kbd className={`text-[10px] px-2 py-0.5 rounded font-mono ${isDark ? 'bg-[#1e1e1e] border-[#555] text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-700'} border`}>{keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Drawing Overlay */}
      {fullscreenDrawing && showDrawing && (
        <div className="fixed inset-0 z-[300] flex flex-col">
          <div className={`flex-1 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
            <DrawingCanvas
              onClose={() => { setFullscreenDrawing(false); setShowDrawing(false); }}
              isFullscreen={true}
              onFullscreen={() => setFullscreenDrawing(false)}
            />
          </div>
          <div className={`h-6 flex items-center justify-center gap-3 text-[10px] shrink-0 ${isDark ? 'bg-[#007acc] text-white' : 'bg-[#007acc] text-white'}`}>
            <span>Fullscreen Drawing</span>
            <button onClick={() => setFullscreenDrawing(false)} className="flex items-center gap-1 opacity-80 hover:opacity-100">
              <Minimize2 size={10} /> Exit Fullscreen
              <kbd className="ml-1 text-[8px] px-1 py-px rounded bg-white/20 border border-white/30 font-mono">Esc</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowShareModal(false)}>
          <div className={`w-[420px] rounded-lg shadow-2xl border overflow-hidden ${isDark ? 'bg-[#252526] border-[#444]' : 'bg-white border-[#ddd]'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-[#333]' : 'border-[#eee]'}`}>
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-blue-400" />
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Share Code</span>
              </div>
              <button onClick={() => setShowShareModal(false)} className={`p-1 rounded text-lg leading-none ${isDark ? 'hover:bg-[#3e3e42] text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}>×</button>
            </div>

            {copyFeedback && (
              <div className="mx-4 mt-3 px-3 py-2 rounded bg-green-600/20 border border-green-500/30 text-green-400 text-[11px] flex items-center gap-2">
                <CheckCircle2 size={12} /> {copyFeedback}
              </div>
            )}

            <div className="p-4 space-y-2">
              <button
                onClick={copyCurrentFile}
                disabled={!activeFileId}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors disabled:opacity-40 ${isDark ? 'hover:bg-[#2d2d2d] text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/15' : 'bg-blue-50'}`}>
                  <Copy size={16} className="text-blue-400" />
                </div>
                <div>
                  <div className={`text-[13px] font-medium ${isDark ? 'text-white' : 'text-black'}`}>Copy Current File</div>
                  <div className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{activeNode ? activeNode.name : 'No file selected'}</div>
                </div>
              </button>

              <button
                onClick={copyAllFiles}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-[#2d2d2d] text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
                  <Files size={16} className="text-purple-400" />
                </div>
                <div>
                  <div className={`text-[13px] font-medium ${isDark ? 'text-white' : 'text-black'}`}>Copy All Files</div>
                  <div className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Copies all project files as text</div>
                </div>
              </button>

              <div className={`h-px my-1 ${isDark ? 'bg-[#333]' : 'bg-[#eee]'}`} />

              <button
                onClick={generateShareLink}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-[#2d2d2d] text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-green-500/15' : 'bg-green-50'}`}>
                  <Link2 size={16} className="text-green-400" />
                </div>
                <div>
                  <div className={`text-[13px] font-medium ${isDark ? 'text-white' : 'text-black'}`}>Copy Shareable Link</div>
                  <div className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Encode your code in a URL others can open</div>
                </div>
              </button>

              <button
                onClick={shareViaEmail}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-[#2d2d2d] text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-orange-500/15' : 'bg-orange-50'}`}>
                  <Mail size={16} className="text-orange-400" />
                </div>
                <div>
                  <div className={`text-[13px] font-medium ${isDark ? 'text-white' : 'text-black'}`}>Share via Email</div>
                  <div className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Open your email client with code attached</div>
                </div>
              </button>

              {'share' in navigator && (
                <button
                  onClick={shareViaWebShare}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-[#2d2d2d] text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-cyan-500/15' : 'bg-cyan-50'}`}>
                    <Share2 size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <div className={`text-[13px] font-medium ${isDark ? 'text-white' : 'text-black'}`}>Share via Device</div>
                    <div className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Use your system's share sheet</div>
                  </div>
                </button>
              )}
            </div>

            <div className={`px-4 py-3 border-t text-[10px] ${isDark ? 'border-[#333] text-gray-600' : 'border-[#eee] text-gray-400'}`}>
              Tip: Download as .zip for easy file sharing, or use the link to let others view your code instantly.
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showCreatePost && <CreatePostModal onClose={() => setShowCreatePost(false)} />}
      {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
};