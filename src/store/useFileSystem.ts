import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { ChallengeMeta, FileSystemState, VFSNode } from '../types/vfs';

interface FileSystemStateWithSplit extends FileSystemState {
  secondaryFileId: string | null;
  isSplit: boolean;
  activePane: 'primary' | 'secondary';
}

interface FileSystemActions {
  createNode: (
    name: string,
    type: 'file' | 'directory',
    parentId: string | null,
    content?: string,
    challengeId?: string,
    challengeMeta?: ChallengeMeta,
  ) => string;
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

const INITIAL_NODES: Record<string, VFSNode> = {};

const DEFAULT_ROOT_IDS: string[] = [];
const DEFAULT_ACTIVE_FILE_ID: string | null = null;
const DEFAULT_OPEN_FILE_IDS: string[] = [];

const isLegacyDefaultLayout = (state: any) => {
  if (!state?.nodes || !state?.rootIds) return false;
  const nodeKeys = Object.keys(state.nodes);
  if (nodeKeys.length !== 3) return false;
  const hasLegacyNodes =
    Boolean(state.nodes['root-readme-md']) &&
    Boolean(state.nodes['src-dir']) &&
    Boolean(state.nodes['root-index-js']);
  if (!hasLegacyNodes) return false;
  const rootSet = new Set(state.rootIds);
  return rootSet.has('root-readme-md') && rootSet.has('src-dir');
};

const isForcedFilenameLayout = (state: any) => {
  if (!state?.nodes || !state?.rootIds) return false;
  const keys = Object.keys(state.nodes);
  if (keys.length !== 1) return false;
  const node = state.nodes['root-filename-js'];
  if (!node) return false;
  return node.name === 'filename.js' && node.parentId === null;
};

export const useFileSystem = create<FileSystemStateWithSplit & FileSystemActions>()(
  persist(
    (set, get) => ({
      nodes: INITIAL_NODES,
      rootIds: DEFAULT_ROOT_IDS,
      activeFileId: DEFAULT_ACTIVE_FILE_ID,
      secondaryFileId: null,
      isSplit: false,
      activePane: 'primary',
      openFileIds: DEFAULT_OPEN_FILE_IDS,

      createNode: (name, type, parentId, content = '', challengeId, challengeMeta) => {
        const id = uuidv4();
        const extension = name.split('.').pop();
        const newNode: VFSNode = { id, name, type, parentId, content, extension, challengeId, challengeMeta };

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
            Object.values(state.nodes).forEach((node) => {
              if (node.parentId === parentId) {
                toDelete.push(node.id);
                if (node.type === 'directory') collectChildren(node.id);
              }
            });
          };

          if (state.nodes[id]?.type === 'directory') collectChildren(id);

          toDelete.forEach((did) => delete newNodes[did]);

          const newRootIds = state.rootIds.filter((rid) => !toDelete.includes(rid));
          const newOpenFileIds = state.openFileIds.filter((oid) => !toDelete.includes(oid));
          const newActiveFileId = toDelete.includes(state.activeFileId || '') ? (newOpenFileIds[0] || null) : state.activeFileId;
          const newSecondaryFileId = toDelete.includes(state.secondaryFileId || '') ? null : state.secondaryFileId;

          return {
            nodes: newNodes,
            rootIds: newRootIds,
            openFileIds: newOpenFileIds,
            activeFileId: newActiveFileId,
            secondaryFileId: newSecondaryFileId,
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
        if (id && get().nodes[id]?.type === 'directory') return;

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
            secondaryFileId: newSecondaryFileId,
          };
        });
      },
    }),
    {
      name: 'syntaxark-filesystem',
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState) return persistedState;
        if (version < 3 && (isLegacyDefaultLayout(persistedState) || isForcedFilenameLayout(persistedState))) {
          return {
            ...persistedState,
            nodes: INITIAL_NODES,
            rootIds: DEFAULT_ROOT_IDS,
            activeFileId: DEFAULT_ACTIVE_FILE_ID,
            secondaryFileId: null,
            openFileIds: DEFAULT_OPEN_FILE_IDS,
            isSplit: false,
            activePane: 'primary',
          };
        }
        return persistedState;
      },
    },
  ),
);
