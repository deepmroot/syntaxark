import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Wifi, WifiOff, MessageSquare, Paintbrush, Power, Settings2, MoreHorizontal } from 'lucide-react';
import { DrawingCanvas } from '../Drawing/DrawingCanvas';
import { useEditor } from '../../store/useEditor';

type Participant = {
  name: string;
  role: string;
  status: 'active' | 'idle' | 'away';
  color: string;
  file?: string;
};

const PARTICIPANTS: Participant[] = [
  { name: 'Ava Chen', role: 'Lead', status: 'active', color: '#22c55e', file: 'index.ts' },
  { name: 'Malik Rivera', role: 'Dev', status: 'active', color: '#3b82f6', file: 'App.tsx' },
  { name: 'Nora Patel', role: 'Design', status: 'idle', color: '#f59e0b' },
  { name: 'Leo Kim', role: 'Research', status: 'away', color: '#a855f7' },
];

export const CollaboratePanel: React.FC = () => {
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';
  const [isLive, setIsLive] = useState(true);
  const [showBoard, setShowBoard] = useState(false);
  const [latency, setLatency] = useState(38);
  const roomCode = useMemo(() => 'ARK-9F7Q', []);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      setLatency(28 + Math.round(Math.random() * 15));
    }, 3000);
    return () => clearInterval(id);
  }, [isLive]);

  const copyInvite = async () => {
    const link = `${window.location.origin}#room=${roomCode}`;
    await navigator.clipboard.writeText(link);
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#1e1e1e] text-gray-300' : 'bg-white text-gray-800'}`}>
      {/* Header */}
      <div className={`p-4 border-b shrink-0 flex items-center justify-between ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-400'}`} />
          <div>
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Team Space</h2>
            <div className="flex items-center gap-1.5 text-[10px] opacity-60">
              <span className="font-mono tracking-wider">{roomCode}</span>
              <span>•</span>
              <span>{PARTICIPANTS.length} online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={copyInvite}
            className={`p-2 rounded-md hover:bg-opacity-10 ${isDark ? 'hover:bg-white' : 'hover:bg-black'}`} 
            title="Copy Invite Link"
          >
            <Copy size={14} />
          </button>
          <button 
            onClick={() => setIsLive(v => !v)}
            className={`p-2 rounded-md transition-colors ${isLive ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
            title={isLive ? "Disconnect" : "Go Live"}
          >
            <Power size={14} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {/* Drawing Board Toggle/View */}
        <div className={`mb-4 rounded-lg overflow-hidden border transition-all duration-300 ${isDark ? 'border-[#333] bg-[#252526]' : 'border-gray-200 bg-gray-50'}`}>
          <div 
            onClick={() => setShowBoard(v => !v)}
            className="flex items-center justify-between p-3 cursor-pointer select-none"
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Paintbrush size={14} className="text-purple-400" />
              <span>Whiteboard</span>
            </div>
            <span className="text-[10px] opacity-50">{showBoard ? 'Close' : 'Open'}</span>
          </div>
          
          {showBoard && (
            <div className="h-64 border-t border-dashed border-opacity-20 border-gray-500 relative">
               <DrawingCanvas onClose={() => {}} /> 
               {/* We don't need the close button inside canvas if we toggle it here, 
                   but DrawingCanvas might have its own toolbar. 
                   We ensure it fits by containment. */}
            </div>
          )}
        </div>

        {/* Participants List */}
        <div className="px-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-50">Members</h3>
            <Settings2 size={12} className="opacity-30 hover:opacity-100 cursor-pointer" />
          </div>
          
          <div className="space-y-1">
            {PARTICIPANTS.map(p => (
              <div 
                key={p.name} 
                className={`group flex items-center gap-3 p-2 rounded-md transition-colors ${isDark ? 'hover:bg-[#2a2d2e]' : 'hover:bg-gray-50'}`}
              >
                <div className="relative shrink-0">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0)}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${isDark ? 'border-[#1e1e1e]' : 'border-white'} ${p.status === 'active' ? 'bg-green-500' : p.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{p.name}</span>
                    <span className="text-[9px] opacity-40">{p.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {p.file ? (
                      <span className="text-[10px] flex items-center gap-1 text-blue-400 truncate">
                        Editing {p.file}
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-40 italic">Idle</span>
                    )}
                  </div>
                </div>

                <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-opacity">
                   <MoreHorizontal size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions / Notes Placeholder */}
        <div className="mt-6 px-2">
          <div className={`p-3 rounded-lg border border-dashed text-center ${isDark ? 'border-[#333] bg-[#1e1e1e]/50' : 'border-gray-200 bg-gray-50'}`}>
            <MessageSquare size={16} className="mx-auto mb-1 opacity-20" />
            <p className="text-[10px] opacity-50">Session chat is empty.</p>
          </div>
        </div>
      </div>

      {/* Footer / Stats */}
      <div className={`p-2 border-t text-[10px] flex items-center justify-between shrink-0 ${isDark ? 'border-[#333] bg-[#252526] text-gray-500' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title="Connection Status">
            {isLive ? <Wifi size={10} className="text-green-500" /> : <WifiOff size={10} />}
            <span>{isLive ? 'Synced' : 'Offline'}</span>
          </div>
          <div className="w-px h-3 bg-current opacity-20" />
          <span>{isLive ? `${latency}ms` : '-'}</span>
        </div>
        <div className="opacity-50">v1.2.0</div>
      </div>
    </div>
  );
};
