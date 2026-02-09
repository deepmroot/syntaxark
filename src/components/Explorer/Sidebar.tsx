import React, { useState, useRef } from 'react';
import { useFileSystem } from '../../store/useFileSystem';
import { useEditor } from '../../store/useEditor';
import { Plus, Trash2, Upload, FolderPlus, Folder, ChevronRight, ChevronDown, Pencil } from 'lucide-react';
import { LANGUAGE_MAP } from '../../data/languages';
import { FileIcon } from './FileIcon';

interface TreeItemProps {
  id: string;
  depth: number;
}

const TreeItem: React.FC<TreeItemProps> = ({ id, depth }) => {
  const { nodes, activeFileId, setActiveFile, deleteNode, createNode, createDirectory, renameNode } = useFileSystem();
  const { theme } = useEditor();
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
  const isDark = theme === 'vs-dark';
  
  const children = Object.values(nodes).filter(n => n.parentId === id);

  const handleCreate = () => {
    if (newName.trim()) {
      if (isCreating === 'file') {
        const ext = newName.split('.').pop();
        const content = ext && LANGUAGE_MAP[ext] ? LANGUAGE_MAP[ext].template : '';
        const newId = createNode(newName.trim(), 'file', id, content);
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
        onClick={() => node.type === 'directory' ? setIsOpen(!isOpen) : setActiveFile(id)}
        onDoubleClick={(e) => { e.stopPropagation(); startRenaming(); }}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        className={`
          group flex items-center py-1 cursor-pointer text-[13px] transition-colors
          ${isActive ? (isDark ? 'bg-[#37373d] text-white' : 'bg-[#e4e6f1] text-black') : (isDark ? 'hover:bg-[#2a2d2e] text-gray-400' : 'hover:bg-[#f0f0f0] text-gray-600')}
        `}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {node.type === 'directory' ? (
            <>
              {isOpen ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
              <Folder size={16} className="text-blue-400 shrink-0" />
            </>
          ) : (
            <FileIcon 
              name={node.name}
              size={16} 
              className="shrink-0 ml-[14px]" 
            />
          )}
          {isRenaming ? (
            <input
              autoFocus
              className={`flex-1 min-w-0 bg-[#3c3c3c] border border-blue-600 outline-none text-xs px-1 ${isDark ? 'text-white' : 'text-black bg-white'}`}
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
            <span className="truncate flex-1">{node.name}</span>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 pr-2 shrink-0">
          {node.type === 'directory' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setIsCreating('file'); }} className="p-0.5 hover:bg-[#454545] rounded"><Plus size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); setIsCreating('folder'); }} className="p-0.5 hover:bg-[#454545] rounded"><FolderPlus size={12} /></button>
            </>
          )}
          <button 
            onClick={(e) => startRenaming(e)}
            className="p-0.5 hover:bg-[#454545] rounded"
            title="Rename"
          >
            <Pencil size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
            className="p-0.5 hover:bg-[#454545] rounded hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {isCreating && (
        <div style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }} className="py-1 pr-4">
          <input
            autoFocus
            className="w-full bg-[#3c3c3c] border border-blue-600 outline-none text-xs px-1 text-white"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            onBlur={handleCreate}
            placeholder={isCreating === 'file' ? 'filename.js' : 'folder name'}
          />
        </div>
      )}

      {node.type === 'directory' && isOpen && (
        <div className="flex flex-col">
          {children.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
          }).map(child => (
            <TreeItem key={child.id} id={child.id} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { rootIds, createNode, createDirectory, nodes } = useFileSystem();
  const [isCreatingRoot, setIsCreatingRoot] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateRoot = () => {
    if (newName.trim()) {
      if (isCreatingRoot === 'file') {
        const ext = newName.split('.').pop();
        const content = ext && LANGUAGE_MAP[ext] ? LANGUAGE_MAP[ext].template : '';
        createNode(newName.trim(), 'file', null, content);
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
    <div className="h-full bg-inherit flex flex-col select-none overflow-hidden">
      <div className="p-3 uppercase text-[11px] font-bold text-gray-500 tracking-wider flex justify-between items-center min-w-0 border-b border-black/10">
        <span className="truncate">Explorer</span>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-black/10 rounded" title="Upload"><Upload size={14} /></button>
          <button onClick={() => setIsCreatingRoot('file')} className="p-1 hover:bg-black/10 rounded" title="New File"><Plus size={14} /></button>
          <button onClick={() => setIsCreatingRoot('folder')} className="p-1 hover:bg-black/10 rounded" title="New Folder"><FolderPlus size={14} /></button>
        </div>
      </div>
      
      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />

      <div className="flex-1 overflow-y-auto custom-scrollbar pt-2">
        {isCreatingRoot && (
          <div className="px-4 py-1">
            <input
              autoFocus
              className="w-full bg-[#3c3c3c] border border-blue-600 outline-none text-xs px-1 text-white"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRoot()}
              onBlur={handleCreateRoot}
            />
          </div>
        )}

        {rootIds.map(id => nodes[id]).sort((a, b) => {
           if (a.type === b.type) return a.name.localeCompare(b.name);
           return a.type === 'directory' ? -1 : 1;
        }).map(node => (
          <TreeItem key={node.id} id={node.id} depth={0} />
        ))}
      </div>
    </div>
  );
};