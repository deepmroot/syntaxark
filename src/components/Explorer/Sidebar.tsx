import React, { useState, useRef } from 'react';
import { useFileSystem } from '../../store/useFileSystem';
import { Plus, Trash2, Upload, FolderPlus, Folder, ChevronRight, ChevronDown, Pencil, Check, Search as SearchIcon } from 'lucide-react';
import { LANGUAGE_MAP } from '../../data/languages';
import { FileIcon } from './FileIcon';

interface TreeItemProps {
  id: string;
  depth: number;
  lastExtension: string | null;
  setLastExtension: (ext: string | null) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
}

type ExtensionSuggestion = {
  ext: string;
  label: string;
};

const EXTENSION_SUGGESTIONS: ExtensionSuggestion[] = Object.entries(LANGUAGE_MAP)
  .map(([ext, cfg]) => ({ ext, label: cfg.name }))
  .sort((a, b) => a.ext.localeCompare(b.ext));

const getFileExtension = (filename: string): string | null => {
  const trimmed = filename.trim();
  const idx = trimmed.lastIndexOf('.');
  if (idx < 0 || idx === trimmed.length - 1) return null;
  const ext = trimmed.slice(idx + 1).toLowerCase();
  return ext || null;
};

const sanitizeExtensionQuery = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const getExtensionSuggestions = (filename: string, lastExtension: string | null): ExtensionSuggestion[] => {
  const idx = filename.lastIndexOf('.');
  if (idx < 0) return [];
  const rawQuery = filename.slice(idx + 1);
  const query = sanitizeExtensionQuery(rawQuery);
  const base = EXTENSION_SUGGESTIONS.filter((s) => s.ext.startsWith(query));
  const unique = new Map<string, ExtensionSuggestion>();
  base.forEach((item) => unique.set(item.ext, item));
  let suggestions = Array.from(unique.values());
  if (lastExtension) {
    const hit = suggestions.find((s) => s.ext === lastExtension);
    if (hit) {
      suggestions = [hit, ...suggestions.filter((s) => s.ext !== lastExtension)];
    }
  }
  return suggestions.slice(0, 8);
};

const applyExtensionSuggestion = (filename: string, suggestionExt: string) => {
  const idx = filename.lastIndexOf('.');
  if (idx < 0) return `${filename}.${suggestionExt}`;
  return `${filename.slice(0, idx + 1)}${suggestionExt}`;
};

const TreeItem: React.FC<TreeItemProps> = ({
  id,
  depth,
  lastExtension,
  setLastExtension,
  selectionMode,
  selectedIds,
  toggleSelected,
}) => {
  const { nodes, activeFileId, setActiveFile, deleteNode, createNode, createDirectory, renameNode } = useFileSystem();
  const [isOpen, setIsOpen] = useState(true);
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const startRenaming = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenameValue(node?.name || '');
    setIsRenaming(true);
  };

  const commitRename = () => {
    if (renameValue.trim() && renameValue.trim() !== node?.name) {
      renameNode(id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const node = nodes[id];
  if (!node) return null;

  const isActive = activeFileId === id;
  const isSelected = selectedIds.has(id);
  const children = Object.values(nodes).filter(n => n.parentId === id);
  const createSuggestions = isCreating === 'file' ? getExtensionSuggestions(newName, lastExtension) : [];

  const handleCreate = () => {
    if (newName.trim()) {
      if (isCreating === 'file') {
        const ext = newName.split('.').pop()?.toLowerCase();
        const content = ext && LANGUAGE_MAP[ext] ? LANGUAGE_MAP[ext].template : '';
        const newId = createNode(newName.trim(), 'file', id, content);
        setLastExtension(getFileExtension(newName.trim()));
        setActiveFile(newId);
      } else {
        createDirectory(newName.trim(), id);
      }
      setNewName('');
    }
    setIsCreating(null);
    setIsOpen(true);
  };

  return (
    <div className="flex flex-col">
      <div 
        onClick={(e) => {
          if (selectionMode || e.metaKey || e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelected(id);
            return;
          }
          node.type === 'directory' ? setIsOpen(!isOpen) : setActiveFile(id);
        }}
        onDoubleClick={(e) => { e.stopPropagation(); startRenaming(); }}
        style={{ paddingLeft: `${depth * 12 + 16}px` }}
        className={`
          group flex items-center h-8 cursor-pointer text-[11px] font-bold uppercase tracking-wider transition-all border-l-2
          ${isSelected
            ? 'bg-blue-500/10 text-white border-blue-500'
            : isActive
              ? 'bg-white/5 text-blue-400 border-blue-500/50'
              : 'hover:bg-white/[0.02] text-gray-500 hover:text-gray-300 border-transparent'}
        `}
      >
        {selectionMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelected(id)}
            onClick={(e) => e.stopPropagation()}
            className="mr-2 h-3 w-3 accent-blue-500"
          />
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {node.type === 'directory' ? (
            <div className="relative">
              {isOpen ? <ChevronDown size={14} className="shrink-0 text-blue-500/60" /> : <ChevronRight size={14} className="shrink-0 text-gray-600" />}
            </div>
          ) : (
            <div className="w-[14px] shrink-0" />
          )}
          
          <div className="shrink-0">
            {node.type === 'directory' ? (
              <Folder size={14} className={`${isOpen ? 'text-blue-400' : 'text-gray-600'} shrink-0`} />
            ) : (
              <FileIcon 
                name={node.name}
                size={14} 
                className="shrink-0" 
              />
            )}
          </div>

          {isRenaming ? (
            <input
              autoFocus
              className="flex-1 min-w-0 bg-black/40 border border-blue-500/50 outline-none text-[10px] px-2 h-6 rounded-lg text-white font-bold uppercase"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1 tracking-widest">{node.name}</span>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 pr-3 shrink-0">
          {node.type === 'directory' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setIsCreating('file'); }} className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-blue-400 transition-colors"><Plus size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); setIsCreating('folder'); }} className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-blue-400 transition-colors"><FolderPlus size={12} /></button>
            </>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); startRenaming(); }}
            className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-blue-400 transition-colors"
            title="Rename"
          >
            <Pencil size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
            className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-rose-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {isCreating && (
        <div style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }} className="py-2 pr-4 relative animate-in slide-in-from-left-2">
          <input
            autoFocus
            className="ethereal-input w-full h-8 px-3 text-[10px] font-black uppercase tracking-widest"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && createSuggestions.length > 0) {
                e.preventDefault();
                setNewName((prev) => applyExtensionSuggestion(prev, createSuggestions[0].ext));
                return;
              }
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsCreating(null);
            }}
            onBlur={handleCreate}
            placeholder={isCreating === 'file' ? 'FILENAME.EXT' : 'FOLDER NAME'}
          />
          {isCreating === 'file' && createSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl shadow-2xl z-20 overflow-hidden border-white/10 mx-4">
              <div className="px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 border-b border-white/5 bg-white/5">
                Language Suggestions
              </div>
              {createSuggestions.map((suggestion, idx) => (
                <button
                  key={suggestion.ext}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white/5 flex items-center justify-between transition-colors ${idx === 0 ? 'text-blue-400' : 'text-gray-500'}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setNewName((prev) => applyExtensionSuggestion(prev, suggestion.ext));
                  }}
                >
                  <span>.{suggestion.ext}</span>
                  <span className="text-[8px] opacity-40">{suggestion.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {node.type === 'directory' && isOpen && (
        <div className="flex flex-col">
          {children.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
          }).map(child => (
            <TreeItem
              key={child.id}
              id={child.id}
              depth={depth + 1}
              lastExtension={lastExtension}
              setLastExtension={setLastExtension}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              toggleSelected={toggleSelected}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { rootIds, createNode, createDirectory, nodes, setActiveFile } = useFileSystem();
  const { deleteNode } = useFileSystem();
  const [isCreatingRoot, setIsCreatingRoot] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const [lastExtension, setLastExtensionState] = useState<string | null>(() => localStorage.getItem('syntaxark-last-created-extension'));
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [treeSearch, setTreeSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootCreateSuggestions = isCreatingRoot === 'file' ? getExtensionSuggestions(newName, lastExtension) : [];

  const setLastExtension = (ext: string | null) => {
    setLastExtensionState(ext);
    if (ext) localStorage.setItem('syntaxark-last-created-extension', ext);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    const selected = Array.from(selectedIds);
    const selectedSet = new Set(selected);
    const isDescendantOfSelected = (id: string) => {
      let cursor = nodes[id]?.parentId || null;
      while (cursor) {
        if (selectedSet.has(cursor)) return true;
        cursor = nodes[cursor]?.parentId || null;
      }
      return false;
    };

    const topLevelSelected = selected.filter((id) => !isDescendantOfSelected(id));
    topLevelSelected.forEach((id) => deleteNode(id));
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const selectAllNodes = () => {
    setSelectedIds(new Set(Object.keys(nodes)));
  };

  const handleCreateRoot = () => {
    if (newName.trim()) {
      if (isCreatingRoot === 'file') {
        const ext = newName.split('.').pop()?.toLowerCase();
        const content = ext && LANGUAGE_MAP[ext] ? LANGUAGE_MAP[ext].template : '';
        createNode(newName.trim(), 'file', null, content);
        setLastExtension(getFileExtension(newName.trim()));
      } else {
        createDirectory(newName.trim(), null);
      }
      setNewName('');
    }
    setIsCreatingRoot(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        createNode(file.name, 'file', null, content);
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full bg-[#141417]/50 backdrop-blur-xl flex flex-col select-none overflow-hidden relative">
      <div className="p-4 uppercase text-[10px] font-black text-gray-500 tracking-[0.3em] flex justify-between items-center min-w-0 border-b border-white/5 bg-white/5">
        <span className="truncate">Files</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              setSelectionMode((v) => !v);
              setSelectedIds(new Set());
            }}
            className={`p-1.5 rounded-lg transition-all ${selectionMode ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-white/5 text-gray-600 hover:text-gray-400'}`}
            title="Select Multiple"
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <button
            onClick={() => setShowSearch((v) => !v)}
            className={`p-1.5 rounded-lg transition-all ${showSearch ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-white/5 text-gray-600 hover:text-gray-400'}`}
            title="Search"
          >
            <SearchIcon size={14} strokeWidth={3} />
          </button>
          
          <div className="w-px h-3 bg-white/10 mx-1" />

          {selectionMode ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
              <button
                onClick={selectAllNodes}
                className="px-2 py-1 hover:bg-white/5 rounded-lg text-[9px] font-black uppercase text-gray-500 hover:text-white transition-all"
              >
                All
              </button>
              <button
                onClick={bulkDeleteSelected}
                disabled={selectedIds.size === 0}
                className="p-1.5 hover:bg-rose-500/10 rounded-lg text-gray-600 hover:text-rose-400 disabled:opacity-20 transition-all"
                title={`Delete Selected (${selectedIds.size})`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-600 hover:text-gray-400 transition-all" title="Upload Source"><Upload size={14} /></button>
              <button onClick={() => setIsCreatingRoot('file')} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-600 hover:text-blue-400 transition-all" title="New File"><Plus size={14} /></button>
              <button onClick={() => setIsCreatingRoot('folder')} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-600 hover:text-blue-400 transition-all" title="New Folder"><FolderPlus size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {showSearch && (
        <div className="p-3 border-b border-white/5 bg-white/[0.02] animate-in slide-in-from-top-2">
          <div className="relative group">
            <SearchIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-400 transition-colors" />
            <input
              autoFocus
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              placeholder="SEARCH FILES..."
              className="ethereal-input w-full h-9 pl-10 pr-4 text-[10px] font-black tracking-widest uppercase"
            />
          </div>
        </div>
      )}
      
      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />

      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {treeSearch.trim().length > 0 && (
          <div className="px-2 space-y-0.5">
            {Object.values(nodes)
              .filter((node) => node.name.toLowerCase().includes(treeSearch.trim().toLowerCase()))
              .slice(0, 100)
              .map((node) => (
                <button
                  key={`search-${node.id}`}
                  onClick={() => {
                    if (node.type === 'file') setActiveFile(node.id);
                  }}
                  className="w-full text-left px-4 py-2 rounded-xl hover:bg-white/5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-all border border-transparent hover:border-white/5"
                >
                  <FileIcon name={node.name} size={14} />
                  <span className="truncate">{node.name}</span>
                </button>
              ))}
          </div>
        )}

        {isCreatingRoot && (
          <div className="px-4 py-2 relative animate-in slide-in-from-left-2">
            <input
              autoFocus
              className="ethereal-input w-full h-9 px-4 text-[10px] font-black tracking-widest uppercase border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && rootCreateSuggestions.length > 0) {
                  e.preventDefault();
                  setNewName((prev) => applyExtensionSuggestion(prev, rootCreateSuggestions[0].ext));
                  return;
                }
                if (e.key === 'Enter') handleCreateRoot();
                if (e.key === 'Escape') setIsCreatingRoot(null);
              }}
              onBlur={handleCreateRoot}
              placeholder={isCreatingRoot === 'file' ? 'FILENAME.EXT' : 'SEGMENT NAME'}
            />
            {isCreatingRoot === 'file' && rootCreateSuggestions.length > 0 && (
              <div className="absolute top-full left-4 right-4 mt-2 glass-panel rounded-xl shadow-2xl z-20 overflow-hidden border-white/10">
                <div className="px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 border-b border-white/5 bg-white/5">
                  Protocol Suggestions
                </div>
                {rootCreateSuggestions.map((suggestion, idx) => (
                  <button
                    key={suggestion.ext}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white/5 flex items-center justify-between transition-colors ${idx === 0 ? 'text-blue-400' : 'text-gray-500'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setNewName((prev) => applyExtensionSuggestion(prev, suggestion.ext));
                    }}
                  >
                    <span>.{suggestion.ext}</span>
                    <span className="text-[8px] opacity-40">{suggestion.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {treeSearch.trim().length === 0 && rootIds.map(id => nodes[id]).filter(Boolean).filter((node) => {
           if (!treeSearch.trim()) return true;
           const q = treeSearch.trim().toLowerCase();
           return node.name.toLowerCase().includes(q);
        }).sort((a, b) => {
           if (a.type === b.type) return a.name.localeCompare(b.name);
           return a.type === 'directory' ? -1 : 1;
        }).map(node => (
          <TreeItem
            key={node.id}
            id={node.id}
            depth={0}
            lastExtension={lastExtension}
            setLastExtension={setLastExtension}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            toggleSelected={toggleSelected}
          />
        ))}
      </div>
    </div>
  );
};
