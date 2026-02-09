import React, { useState } from 'react';
import { Search as SearchIcon, FileCode } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';
import { LANGUAGE_MAP } from '../../data/languages';

export const Search: React.FC = () => {
  const { nodes, setActiveFile } = useFileSystem();
  const [query, setQuery] = useState('');

  const results = query.trim() 
    ? Object.values(nodes).filter(n => 
        n.type === 'file' && 
        (n.name.toLowerCase().includes(query.toLowerCase()) || 
         n.content?.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  return (
    <div className="h-full bg-[#252526] flex flex-col select-none overflow-hidden">
      <div className="p-3 uppercase text-[11px] font-bold text-gray-500 tracking-wider border-b border-[#333]">
        Search
      </div>
      <div className="p-4">
        <div className="relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            autoFocus
            className="w-full bg-[#3c3c3c] border border-transparent focus:border-blue-600 outline-none text-sm pl-9 pr-3 py-1.5 text-white placeholder-gray-500 rounded-sm transition-all"
            placeholder="Search files or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-1 text-[10px] text-gray-500 italic">
          Tip: Searches filenames and file content.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        {results.map(file => {
          const ext = file.name.split('.').pop() || '';
          const langConfig = LANGUAGE_MAP[ext];
          
          return (
            <div 
              key={file.id}
              onClick={() => setActiveFile(file.id)}
              className="group flex flex-col p-2 hover:bg-[#2a2d2e] cursor-pointer rounded mb-1 border border-transparent hover:border-[#444] transition-all"
            >
              <div className="flex items-center gap-2 text-sm text-gray-300 group-hover:text-white font-medium">
                <FileCode 
                  size={14} 
                  className="shrink-0" 
                  style={{ color: langConfig?.color || '#858585' }}
                />
                {file.name}
              </div>
              <div className="text-[11px] text-gray-500 truncate mt-1 pl-5">
                {file.parentId ? 'In subfolder' : 'Root directory'}
              </div>
            </div>
          );
        })}
        {query && results.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm italic">
            No results found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
};
