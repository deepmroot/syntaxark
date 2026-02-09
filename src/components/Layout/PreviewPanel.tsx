import React, { useMemo } from 'react';
import { Globe, ExternalLink, X } from 'lucide-react';
import { useEditor } from '../../store/useEditor';

interface PreviewPanelProps {
  isDark: boolean;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ isDark }) => {
  const { previewCode, setPreviewCode } = useEditor();
  
  const srcDoc = useMemo(() => previewCode || '', [previewCode]);

  if (!previewCode) return null;

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
      <div className={`h-9 flex items-center justify-between px-3 border-b shrink-0 ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-blue-400" />
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Live Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => {
              const blob = new Blob([previewCode], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
            }}
            className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#3e3e42]' : 'text-gray-500 hover:text-black hover:bg-[#e1e1e1]'}`}
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </button>
          <button 
            onClick={() => setPreviewCode(null)}
            className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#3e3e42]' : 'text-gray-500 hover:text-black hover:bg-[#e1e1e1]'}`}
            title="Close Preview"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white relative">
        <iframe
          srcDoc={srcDoc}
          title="Preview"
          className="w-full h-full border-0"
          style={{ backgroundColor: 'white' }}
          sandbox="allow-scripts allow-modals allow-popups"
        />
      </div>
    </div>
  );
};
