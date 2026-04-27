import { useEffect } from 'react';
import { MonacoBinding } from 'y-monaco';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useFileSystem } from '../../store/useFileSystem';
import { acquireSharedEditorSession, releaseSharedEditorSession } from './session';

interface UseSharedEditorArgs {
  roomId: string | null;
  userId: string | null;
  username?: string;
  fileId: string | null;
  filePath: string | null;
  initialContent: string;
  editor: any;
  monaco: any;
  enabled: boolean;
  canEdit: boolean;
}

const PERSIST_MS = 900;

const getUserColor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 72% 60%)`;
};

export const useSharedEditor = ({
  roomId,
  userId,
  username,
  fileId,
  filePath,
  initialContent,
  editor,
  monaco,
  enabled,
  canEdit,
}: UseSharedEditorArgs) => {
  const upsertRoomFile = useMutation(api.rooms.upsertRoomFile);

  useEffect(() => {
    if (!enabled || !roomId || !userId || !fileId || !filePath || !editor || !monaco) return;

    const roomIdArg = roomId as unknown as Id<'rooms'>;
    const userIdArg = userId as unknown as Id<'users'>;
    const session = acquireSharedEditorSession(roomId, filePath);
    const model = editor.getModel();
    if (!model) {
      releaseSharedEditorSession(session);
      return;
    }

    if (canEdit && session.text.length === 0 && initialContent) {
      session.doc.transact(() => {
        session.text.insert(0, initialContent);
      });
    }

    const awareness = session.provider.awareness;
    awareness.setLocalStateField('user', {
      name: username || 'User',
      color: getUserColor(userId),
    });

    const syncLocalContent = () => {
      const next = session.text.toString();
      const state = useFileSystem.getState();
      const node = state.nodes[fileId];
      if (!node) return;
      if ((node.content || '') !== next) {
        state.updateFileContent(fileId, next);
      }
    };

    syncLocalContent();

    let persistTimeout: number | null = null;
    const schedulePersist = () => {
      if (!canEdit) return;
      if (persistTimeout !== null) window.clearTimeout(persistTimeout);
      persistTimeout = window.setTimeout(() => {
        persistTimeout = null;
        const content = session.text.toString();
        void upsertRoomFile({
          roomId: roomIdArg,
          userId: userIdArg,
          path: filePath,
          content,
        }).catch(() => {});
      }, PERSIST_MS);
    };

    const observer = () => {
      syncLocalContent();
      schedulePersist();
    };

    session.text.observe(observer);

    const binding = new MonacoBinding(session.text, model, new Set([editor]), awareness);
    const disposeListener = editor.onDidDispose(() => {
      binding.destroy();
    });

    return () => {
      if (persistTimeout !== null) window.clearTimeout(persistTimeout);
      disposeListener.dispose();
      session.text.unobserve(observer);
      binding.destroy();
      releaseSharedEditorSession(session);
    };
  }, [canEdit, editor, enabled, fileId, filePath, initialContent, monaco, roomId, upsertRoomFile, userId, username]);
};
