import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { EditorPresenceCursor, WhiteboardPresenceCursor } from '../core/types';

interface UseRoomPresenceArgs {
  roomId: string | null;
  userId: string | null;
  enabled: boolean;
  currentFile?: string;
  currentTask?: string;
}

const HEARTBEAT_MS = 10_000;
const THROTTLE_MS = 400;

export const useRoomPresence = ({
  roomId,
  userId,
  enabled,
  currentFile,
  currentTask,
}: UseRoomPresenceArgs) => {
  const updatePresenceContext = useMutation(api.rooms.updatePresenceContext);
  const editorCursorRef = useRef<EditorPresenceCursor | null>(null);
  const whiteboardCursorRef = useRef<WhiteboardPresenceCursor | null>(null);
  const isSharingWhiteboardRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const sendTimeoutRef = useRef<number | null>(null);

  const roomIdArg = useMemo(
    () => (roomId ? (roomId as unknown as Id<'rooms'>) : null),
    [roomId],
  );
  const userIdArg = useMemo(
    () => (userId ? (userId as unknown as Id<'users'>) : null),
    [userId],
  );

  const clearScheduledSend = useCallback(() => {
    if (sendTimeoutRef.current !== null) {
      window.clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }
  }, []);

  const buildPayload = useCallback(() => {
    if (!enabled || !roomIdArg || !userIdArg) return null;
    const editorCursor = editorCursorRef.current;
    const whiteboardCursor = whiteboardCursorRef.current;

    return {
      roomId: roomIdArg,
      userId: userIdArg,
      status: 'active',
      currentFile: currentFile || undefined,
      currentTask: currentTask || undefined,
      cursorLine: editorCursor?.line,
      cursorColumn: editorCursor?.column,
      cursorPath: editorCursor?.path || currentFile || undefined,
      isSharingWhiteboard: isSharingWhiteboardRef.current,
      cursorX: whiteboardCursor?.x,
      cursorY: whiteboardCursor?.y,
    };
  }, [currentFile, currentTask, enabled, roomIdArg, userIdArg]);

  const sendPresence = useCallback(
    (mode: 'immediate' | 'throttled' | 'heartbeat' = 'immediate') => {
      const payload = buildPayload();
      if (!payload) return;

      const now = Date.now();
      const elapsed = now - lastSentAtRef.current;
      const shouldBypassThrottle = mode === 'heartbeat' || mode === 'throttled';

      if (!shouldBypassThrottle && elapsed < THROTTLE_MS) {
        if (sendTimeoutRef.current !== null) return;
        sendTimeoutRef.current = window.setTimeout(() => {
          sendTimeoutRef.current = null;
          sendPresence('throttled');
        }, THROTTLE_MS - elapsed);
        return;
      }

      clearScheduledSend();
      lastSentAtRef.current = now;
      void updatePresenceContext(payload).catch(() => {});
    },
    [buildPayload, clearScheduledSend, updatePresenceContext],
  );

  useEffect(() => {
    if (!enabled) {
      clearScheduledSend();
      return;
    }

    sendPresence('immediate');
    const intervalId = window.setInterval(() => sendPresence('heartbeat'), HEARTBEAT_MS);
    return () => {
      window.clearInterval(intervalId);
      clearScheduledSend();
    };
  }, [clearScheduledSend, enabled, sendPresence]);

  useEffect(() => {
    if (!enabled) return;
    sendPresence('immediate');
  }, [currentFile, currentTask, enabled, sendPresence]);

  const reportEditorCursor = useCallback(
    (cursor: EditorPresenceCursor) => {
      const previous = editorCursorRef.current;
      if (
        previous &&
        previous.line === cursor.line &&
        previous.column === cursor.column &&
        previous.path === cursor.path
      ) {
        return;
      }
      editorCursorRef.current = cursor;
      sendPresence('immediate');
    },
    [sendPresence],
  );

  const reportWhiteboardCursor = useCallback((cursor: WhiteboardPresenceCursor) => {
    whiteboardCursorRef.current = cursor;
  }, []);

  const setWhiteboardSharing = useCallback(
    (isSharing: boolean) => {
      if (isSharingWhiteboardRef.current === isSharing) return;
      isSharingWhiteboardRef.current = isSharing;
      sendPresence('immediate');
    },
    [sendPresence],
  );

  return {
    reportEditorCursor,
    reportWhiteboardCursor,
    setWhiteboardSharing,
  };
};
