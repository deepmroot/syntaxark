import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { FileSystemState, VFSNode } from '../types/vfs';

interface FileSystemStateWithSplit extends FileSystemState {
  secondaryFileId: string | null;
  isSplit: boolean;
  activePane: 'primary' | 'secondary';
}

interface FileSystemActions {
  createNode: (name: string, type: 'file' | 'directory', parentId: string | null, content?: string, challengeId?: string) => string;
  updateFileContent: (id: string, content: string) => void;
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  createDirectory: (name: string, parentId: string | null) => string;
  setActiveFile: (id: string | null) => void;
  setSecondaryFile: (id: string | null) => void;
  toggleSplit: () => void;
  setActivePane: (pane: 'primary' | 'secondary') => void;
  closeFile: (id: string) => void;
}

const INITIAL_NODES: Record<string, VFSNode> = {
  'root-readme-md': {
    id: 'root-readme-md',
    name: 'README.md',
    type: 'file',
    parentId: null,
    content: `# Welcome to SyntaxArk 🚀\n\nA high-performance, multi-file code playground.`,
    extension: 'md',
  },
  'src-dir': {
    id: 'src-dir',
    name: 'src',
    type: 'directory',
    parentId: null,
  },
  'root-index-js': {
    id: 'root-index-js',
    name: 'index.js',
    type: 'file',
    parentId: 'src-dir',
    content: `console.log("Hello from nested folder!");`,
    extension: 'js',
  }
};

export const useFileSystem = create<FileSystemStateWithSplit & FileSystemActions>()(
  persist(
    (set, get) => ({
      nodes: INITIAL_NODES,
      rootIds: ['root-readme-md', 'src-dir'],
      activeFileId: 'root-readme-md',
      secondaryFileId: null,
      isSplit: false,
      activePane: 'primary',
      openFileIds: ['root-readme-md'],

      createNode: (name, type, parentId, content = '', challengeId) => {
        const id = uuidv4();
        const extension = name.split('.').pop();
        const newNode: VFSNode = { id, name, type, parentId, content, extension, challengeId };

        set((state) => ({
          nodes: { ...state.nodes, [id]: newNode },
          rootIds: parentId === null ? [...state.rootIds, id] : state.rootIds,
        }));

        return id;
      },

      createDirectory: (name, parentId) => {
        const id = uuidv4();
        const newNode: VFSNode = { id, name, type: 'directory', parentId };
        set((state) => ({
          nodes: { ...state.nodes, [id]: newNode },
          rootIds: parentId === null ? [...state.rootIds, id] : state.rootIds,
        }));
        return id;
      },

      updateFileContent: (id, content) => {
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: { ...state.nodes[id], content },
          },
        }));
      },

      deleteNode: (id) => {
        set((state) => {
          const newNodes = { ...state.nodes };
          const toDelete = [id];
          
          const collectChildren = (parentId: string) => {
            Object.values(state.nodes).forEach(node => {
              if (node.parentId === parentId) {
                toDelete.push(node.id);
                if (node.type === 'directory') collectChildren(node.id);
              }
            });
          };
          
          if (state.nodes[id]?.type === 'directory') collectChildren(id);
          
          toDelete.forEach(did => delete newNodes[did]);

          const newRootIds = state.rootIds.filter((rid) => !toDelete.includes(rid));
          const newOpenFileIds = state.openFileIds.filter((oid) => !toDelete.includes(oid));
          const newActiveFileId = toDelete.includes(state.activeFileId || '') ? (newOpenFileIds[0] || null) : state.activeFileId;
          const newSecondaryFileId = toDelete.includes(state.secondaryFileId || '') ? null : state.secondaryFileId;

          return {
            nodes: newNodes,
            rootIds: newRootIds,
            openFileIds: newOpenFileIds,
            activeFileId: newActiveFileId,
            secondaryFileId: newSecondaryFileId
          };
        });
      },

      renameNode: (id, newName) => {
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: { ...state.nodes[id], name: newName, extension: newName.split('.').pop() },
          },
        }));
      },

      setActiveFile: (id) => {
        if (id && (get().nodes[id]?.type === 'directory')) return;
        
        set((state) => {
          if (state.activePane === 'secondary') {
            return {
              secondaryFileId: id,
              openFileIds: id && !state.openFileIds.includes(id) ? [...state.openFileIds, id] : state.openFileIds,
            };
          }
          return {
            activeFileId: id,
            openFileIds: id && !state.openFileIds.includes(id) ? [...state.openFileIds, id] : state.openFileIds,
          };
        });
      },

      setSecondaryFile: (id) => set({ secondaryFileId: id }),
      toggleSplit: () => set((state) => ({ isSplit: !state.isSplit, activePane: 'primary' })),
      setActivePane: (pane) => set({ activePane: pane }),

      closeFile: (id) => {
        set((state) => {
          const newOpenFileIds = state.openFileIds.filter((openId) => openId !== id);
          const newActiveFileId = state.activeFileId === id ? (newOpenFileIds[0] || null) : state.activeFileId;
          const newSecondaryFileId = state.secondaryFileId === id ? null : state.secondaryFileId;
          return {
            openFileIds: newOpenFileIds,
            activeFileId: newActiveFileId,
            secondaryFileId: newSecondaryFileId
          };
        });
      },
    }),
    {
      name: 'syntaxark-filesystem',
    }
  )
);
