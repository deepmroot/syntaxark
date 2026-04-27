import type { VFSNode } from '../../types/vfs';
import { useFileSystem } from '../../store/useFileSystem';

const findChild = (
  nodes: Record<string, VFSNode>,
  parentId: string | null,
  name: string,
  type?: 'file' | 'directory',
) => Object.values(nodes).find((node) => node.parentId === parentId && node.name === name && (!type || node.type === type));

export const findNodeIdByPath = (
  nodes: Record<string, VFSNode>,
  path: string,
): string | null => {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  let parentId: string | null = null;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const node = findChild(nodes, parentId, part);
    if (!node) return null;
    parentId = node.id;
  }

  return parentId;
};

export const ensureFileAtPath = (path: string, content: string) => {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  let parentId: string | null = null;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const state = useFileSystem.getState();
    const existing = findChild(state.nodes, parentId, part, 'directory');
    parentId = existing ? existing.id : state.createDirectory(part, parentId);
  }

  const fileName = parts[parts.length - 1];
  const state = useFileSystem.getState();
  const existingFile = findChild(state.nodes, parentId, fileName, 'file');
  if (existingFile) {
    if ((existingFile.content || '') !== content) {
      state.updateFileContent(existingFile.id, content);
    }
    return existingFile.id;
  }

  return state.createNode(fileName, 'file', parentId, content);
};
