export type FileType = 'file' | 'directory';

export interface ChallengeTestCase {
  input: any[];
  expected: any;
  name: string;
}

export interface ChallengeMeta {
  source: 'builtin' | 'leetcode' | 'ai' | 'community';
  title: string;
  description: string;
  difficulty?: string;
  functionName?: string;
  testCases?: ChallengeTestCase[];
  externalUrl?: string;
  tags?: string[];
  companyTags?: string[];
}

export interface VFSNode {
  id: string;
  name: string;
  type: FileType;
  parentId: string | null;
  content?: string; // Only for files
  extension?: string;
  challengeId?: string;
  challengeMeta?: ChallengeMeta;
}

export interface FileSystemState {
  nodes: Record<string, VFSNode>;
  rootIds: string[];
  activeFileId: string | null;
  openFileIds: string[];
}
