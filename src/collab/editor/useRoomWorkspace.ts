import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useFileSystem } from '../../store/useFileSystem';
import { ensureFileAtPath } from '../core/filesystem';
import { getNodePath } from '../core/path';

interface RoomFileRow {
  _id: string;
  path: string;
  content: string;
}

interface UseRoomWorkspaceArgs {
  roomId: string | null;
  userId: string | null;
  enabled: boolean;
  canSeed: boolean;
}

export const useRoomWorkspace = ({ roomId, userId, enabled, canSeed }: UseRoomWorkspaceArgs) => {
  const { nodes } = useFileSystem();
  const initializeSharedWorkspace = useMutation(api.rooms.initializeSharedWorkspace);
  const roomIdArg = useMemo(() => (roomId ? (roomId as unknown as Id<'rooms'>) : null), [roomId]);
  const userIdArg = useMemo(() => (userId ? (userId as unknown as Id<'users'>) : null), [userId]);
  const roomFiles = (useQuery(api.rooms.listRoomFiles, roomIdArg ? { roomId: roomIdArg } : 'skip') || []) as RoomFileRow[];
  const seededRoomsRef = useRef<Record<string, boolean>>({});
  const importedSignatureRef = useRef('');

  const localFiles = useMemo(
    () => Object.values(nodes)
      .filter((node) => node.type === 'file')
      .map((node) => ({
        path: getNodePath(nodes, node.id),
        content: node.content || '',
      }))
      .filter((row): row is { path: string; content: string } => Boolean(row.path)),
    [nodes],
  );

  useEffect(() => {
    if (!enabled || !canSeed || !roomId || !roomIdArg || !userIdArg) return;
    if (roomFiles.length > 0) return;
    if (seededRoomsRef.current[roomId]) return;
    if (localFiles.length === 0) return;

    seededRoomsRef.current[roomId] = true;
    void initializeSharedWorkspace({
      roomId: roomIdArg,
      userId: userIdArg,
      files: localFiles,
    }).catch(() => {
      seededRoomsRef.current[roomId] = false;
    });
  }, [canSeed, enabled, initializeSharedWorkspace, localFiles, roomFiles.length, roomId, roomIdArg, userIdArg]);

  useEffect(() => {
    if (!enabled || roomFiles.length === 0) return;

    const signature = roomFiles
      .map((file) => `${file.path}:${file.content}`)
      .sort()
      .join('|');
    if (signature === importedSignatureRef.current) return;
    importedSignatureRef.current = signature;

    roomFiles.forEach((file) => {
      ensureFileAtPath(file.path, file.content || '');
    });
  }, [enabled, roomFiles]);
};
