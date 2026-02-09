export type FileType = 'file' | 'directory';

export interface VFSNode {
  id: string;
  name: string;
  type: FileType;
  parentId: string | null;
  content?: string; // Only for files
  extension?: string;
  challengeId?: string;
}

export interface FileSystemState {
  nodes: Record<string, VFSNode>;
  rootIds: string[];
  activeFileId: string | null;
  openFileIds: string[];
}
