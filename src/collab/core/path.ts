import type { VFSNode } from '../../types/vfs';

export const getNodePath = (
  nodes: Record<string, VFSNode>,
  nodeId: string | null | undefined,
): string | null => {
  if (!nodeId || !nodes[nodeId]) return null;

  const segments: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null | undefined = nodeId;

  while (currentId) {
    if (seen.has(currentId)) break;
    seen.add(currentId);

    const node: VFSNode | undefined = nodes[currentId];
    if (!node) break;
    segments.unshift(node.name);
    currentId = node.parentId;
  }

  return segments.join('/');
};
