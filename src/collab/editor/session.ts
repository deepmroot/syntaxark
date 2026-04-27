import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export interface SharedEditorSession {
  key: string;
  roomName: string;
  refs: number;
  doc: Y.Doc;
  provider: WebrtcProvider;
  text: Y.Text;
}

const sessions = new Map<string, SharedEditorSession>();

const createRoomName = (roomId: string, filePath: string) =>
  `syntaxark:${roomId}:${encodeURIComponent(filePath)}`;

export const acquireSharedEditorSession = (roomId: string, filePath: string) => {
  const key = `${roomId}::${filePath}`;
  const existing = sessions.get(key);
  if (existing) {
    existing.refs += 1;
    return existing;
  }

  const doc = new Y.Doc();
  const roomName = createRoomName(roomId, filePath);
  const provider = new WebrtcProvider(roomName, doc);
  const session: SharedEditorSession = {
    key,
    roomName,
    refs: 1,
    doc,
    provider,
    text: doc.getText('content'),
  };

  sessions.set(key, session);
  return session;
};

export const releaseSharedEditorSession = (session: SharedEditorSession) => {
  const current = sessions.get(session.key);
  if (!current) return;
  current.refs -= 1;
  if (current.refs > 0) return;
  current.provider.destroy();
  current.doc.destroy();
  sessions.delete(session.key);
};
