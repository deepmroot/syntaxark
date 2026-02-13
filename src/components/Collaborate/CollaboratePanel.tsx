import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, LogOut, MessageSquare, Paintbrush, Plus, Send, Users, Wifi, WifiOff } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useEditor } from '../../store/useEditor';
import { useAuth } from '../../store/useAuth';
import { useCollabSession } from '../../store/useCollabSession';
import { DrawingCanvas } from '../Drawing/DrawingCanvas';

type Participant = {
  _id: string;
  userId: string;
  username: string;
  role?: 'owner' | 'editor' | 'viewer';
  currentFile?: string;
  currentTask?: string;
};

type RoomMessage = {
  _id: string;
  senderName: string;
  content: string;
};

type WhiteboardSnapshot = {
  snapshot?: string;
  updatedAt?: number;
  updatedBy?: string;
} | null;

type WhiteboardPresence = {
  userId: string;
  username?: string;
  color?: string;
  cursorX?: number;
  cursorY?: number;
  isSharing?: boolean;
};

export const CollaboratePanel: React.FC = () => {
  const { theme } = useEditor();
  const { user, setShowAuth } = useAuth();
  const { roomId, roomCode, setSession, clearSession } = useCollabSession();
  const isDark = theme === 'vs-dark';

  const [joinCode, setJoinCode] = useState(roomCode || '');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | 'leave' | ''>('');
  const [showBoard, setShowBoard] = useState(false);
  const [isSharingBoard, setIsSharingBoard] = useState(true);
  const [messageDraft, setMessageDraft] = useState('');
  const snapshotVersionRef = useRef(0);
  const snapshotDebounceRef = useRef<number | null>(null);
  const lastCursorSendRef = useRef(0);
  const roomIdArg = roomId ? (roomId as unknown as Id<'rooms'>) : null;
  const userIdArg = user?.id ? (user.id as unknown as Id<'users'>) : null;

  const room = useQuery(api.rooms.getRoom, roomIdArg ? { roomId: roomIdArg } : 'skip');
  const participants = (useQuery(api.rooms.getParticipants, roomIdArg ? { roomId: roomIdArg } : 'skip') || []) as Participant[];
  const messages = (useQuery(api.rooms.getMessages, roomIdArg ? { roomId: roomIdArg } : 'skip') || []) as RoomMessage[];
  const whiteboard = useQuery(api.rooms.getWhiteboardSnapshot, roomIdArg ? { roomId: roomIdArg } : 'skip') as WhiteboardSnapshot;
  const whiteboardPresence = (useQuery(api.rooms.getWhiteboardPresence, roomIdArg ? { roomId: roomIdArg } : 'skip') || []) as WhiteboardPresence[];

  const createRoom = useMutation(api.rooms.createRoom);
  const joinRoom = useMutation(api.rooms.joinRoom);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const ping = useMutation(api.rooms.ping);
  const sendMessage = useMutation(api.rooms.sendMessage);
  const updateWhiteboardSnapshot = useMutation(api.rooms.updateWhiteboardSnapshot);
  const updateWhiteboardCursor = useMutation(api.rooms.updateWhiteboardCursor);

  const canUseCollab = Boolean(user && !user.isGuest);
  const normalizedJoinCode = useMemo(() => joinCode.trim().toUpperCase(), [joinCode]);
  const meParticipant = participants.find((p) => user && p.userId === user.id);
  const canEditBoard = Boolean(meParticipant && meParticipant.role !== 'viewer');

  const remoteCursors = whiteboardPresence
    .filter((row) => !user || row.userId !== user.id)
    .map((row) => ({
      userId: String(row.userId),
      username: String(row.username || 'User'),
      color: String(row.color || '#60a5fa'),
      cursorX: typeof row.cursorX === 'number' ? row.cursorX : undefined,
      cursorY: typeof row.cursorY === 'number' ? row.cursorY : undefined,
      isSharing: Boolean(row.isSharing),
    }));

  useEffect(() => {
    const raw = (window.location.hash || '').slice(1);
    const params = new URLSearchParams(raw);
    const hashRoom = params.get('room');
    if (hashRoom) setJoinCode(hashRoom.toUpperCase());
  }, []);

  useEffect(() => {
    if (!roomId || !user || user.isGuest) return;
    if (!roomIdArg || !userIdArg) return;
    const tick = () => {
      void ping({ roomId: roomIdArg, userId: userIdArg }).catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, [roomId, roomIdArg, user, userIdArg, ping]);

  const setToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(''), 1800);
  };

  const handleCreate = async () => {
    if (!canUseCollab || !user) {
      setShowAuth(true);
      return;
    }
    if (!userIdArg) return;
    setBusy('create');
    try {
      const created = await createRoom({ hostId: userIdArg });
      if (created?.roomId && created?.code) {
        await joinRoom({
          roomCode: String(created.code),
          userId: userIdArg,
          username: user.username,
        });
        setSession(String(created.roomId), String(created.code));
        setJoinCode(String(created.code));
        setToast('Room created');
      }
    } catch {
      setToast('Failed to create room');
    } finally {
      setBusy('');
    }
  };

  const handleJoin = async () => {
    if (!canUseCollab || !user) {
      setShowAuth(true);
      return;
    }
    if (!userIdArg) return;
    if (!normalizedJoinCode) {
      setToast('Enter a room code');
      return;
    }
    setBusy('join');
    try {
      const joinedRoomId = await joinRoom({
        roomCode: normalizedJoinCode,
        userId: userIdArg,
        username: user.username,
      });
      if (!joinedRoomId) {
        setToast('Room not found');
        return;
      }
      setSession(String(joinedRoomId), normalizedJoinCode);
      setToast('Joined room');
    } catch {
      setToast('Failed to join room');
    } finally {
      setBusy('');
    }
  };

  const handleLeave = async () => {
    if (!roomId || !user) return;
    if (!roomIdArg || !userIdArg) return;
    setBusy('leave');
    try {
      await leaveRoom({ roomId: roomIdArg, userId: userIdArg });
    } catch {
      // ignore and clear local session anyway
    } finally {
      clearSession();
      setBusy('');
      setToast('Left room');
    }
  };

  const copyInvite = async () => {
    if (!roomCode) return;
    const link = `${window.location.origin}${window.location.pathname}#room=${roomCode}`;
    await navigator.clipboard.writeText(link);
    setToast('Invite link copied');
  };

  const sendRoomMessage = async () => {
    if (!roomId || !user || !messageDraft.trim()) return;
    if (!roomIdArg || !userIdArg) return;
    const content = messageDraft.trim();
    setMessageDraft('');
    try {
      await sendMessage({
        roomId: roomIdArg,
        senderId: userIdArg,
        senderName: user.username,
        content,
      });
    } catch {
      setToast('Failed to send message');
      setMessageDraft(content);
    }
  };

  const onBoardSnapshot = (snapshot: string) => {
    if (!roomId || !user || !canEditBoard) return;
    if (!roomIdArg || !userIdArg) return;
    snapshotVersionRef.current += 1;
    const version = snapshotVersionRef.current;
    if (snapshotDebounceRef.current) window.clearTimeout(snapshotDebounceRef.current);
    snapshotDebounceRef.current = window.setTimeout(() => {
      if (version !== snapshotVersionRef.current) return;
      void updateWhiteboardSnapshot({
        roomId: roomIdArg,
        userId: userIdArg,
        snapshot,
      }).catch(() => {});
    }, 240);
  };

  const onBoardCursor = (x: number, y: number) => {
    if (!roomId || !user) return;
    if (!roomIdArg || !userIdArg) return;
    const now = Date.now();
    if (now - lastCursorSendRef.current < 80) return;
    lastCursorSendRef.current = now;
    void updateWhiteboardCursor({
      roomId: roomIdArg,
      userId: userIdArg,
      cursorX: x,
      cursorY: y,
      isSharing: showBoard && isSharingBoard,
    }).catch(() => {});
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#13161f] text-gray-300' : 'bg-[#f7f9fc] text-gray-800'}`}>
      <div className={`p-4 border-b backdrop-blur-xl ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-white/80'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>Collaboration</h2>
            <div className="text-[11px] opacity-70 mt-1">
              {roomId ? `Room ${roomCode}` : 'Not connected'}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {roomId ? <Wifi size={13} className="text-emerald-400" /> : <WifiOff size={13} className="opacity-60" />}
            <span>{roomId ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            className={`flex-1 h-9 px-3 rounded-md border text-xs font-mono tracking-wider ${
              isDark
                ? 'bg-[#252526] border-[#3a3a3a] text-gray-200'
                : 'bg-gray-50 border-gray-300 text-gray-800'
            }`}
          />
          <button
            onClick={handleJoin}
            disabled={busy !== '' || !normalizedJoinCode}
            className="h-9 px-3 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Join
          </button>
          <button
            onClick={handleCreate}
            disabled={busy !== ''}
            className="h-9 px-3 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Plus size={12} /> New
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={copyInvite}
            disabled={!roomId}
            className={`h-8 px-3 rounded-md text-xs border inline-flex items-center gap-1 ${
              isDark ? 'border-[#3a3a3a] hover:bg-[#2a2a2a]' : 'border-gray-300 hover:bg-gray-100'
            } disabled:opacity-40`}
          >
            <Copy size={12} /> Copy Invite
          </button>
          <button
            onClick={handleLeave}
            disabled={!roomId || busy !== ''}
            className={`h-8 px-3 rounded-md text-xs border inline-flex items-center gap-1 ${
              isDark ? 'border-[#3a3a3a] hover:bg-[#2a2a2a]' : 'border-gray-300 hover:bg-gray-100'
            } disabled:opacity-40`}
          >
            <LogOut size={12} /> Leave
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mx-4 mt-3 text-[11px] px-3 py-2 rounded-md border ${isDark ? 'bg-[#1d212e] border-white/10' : 'bg-white border-gray-200'}`}>
          {feedback}
        </div>
      )}

      {!canUseCollab && (
        <div className="mx-4 mt-3 text-[11px] px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
          Sign in to create or join collaboration rooms.
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
        <div className={`rounded-lg border glass-card ${isDark ? 'border-white/10 bg-[#1c2130]/80' : 'border-gray-200 bg-white/90'}`}>
          <div className={`px-3 py-2 border-b text-[11px] font-semibold flex items-center justify-between ${isDark ? 'border-[#333]' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Paintbrush size={13} />
              Whiteboard
            </div>
            <button
              onClick={() => setShowBoard((prev) => !prev)}
              className={`text-[10px] px-2 py-1 rounded border ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-gray-300 hover:bg-gray-100'}`}
            >
              {showBoard ? 'Hide' : 'Open'}
            </button>
          </div>
          {showBoard && (
            <div className="p-2 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="opacity-70">{canEditBoard ? 'You can edit' : 'View only'}</span>
                <label className="flex items-center gap-1 opacity-80">
                  <input
                    type="checkbox"
                    checked={isSharingBoard}
                    onChange={(e) => setIsSharingBoard(e.target.checked)}
                    className="accent-blue-500"
                  />
                  Share cursor
                </label>
              </div>
              <div className="h-64 rounded-md overflow-hidden border border-white/10">
                <DrawingCanvas
                  onClose={() => setShowBoard(false)}
                  canEdit={canEditBoard}
                  initialSnapshot={whiteboard?.snapshot || null}
                  snapshotVersion={whiteboard?.updatedAt || 0}
                  snapshotUpdatedBy={whiteboard?.updatedBy ? String(whiteboard.updatedBy) : undefined}
                  localUserId={user?.id}
                  onSnapshotChange={onBoardSnapshot}
                  onCursorMove={onBoardCursor}
                  remoteCursors={remoteCursors}
                />
              </div>
            </div>
          )}
        </div>

        <div className={`rounded-lg border glass-card ${isDark ? 'border-white/10 bg-[#1c2130]/80' : 'border-gray-200 bg-white/90'}`}>
          <div className={`px-3 py-2 border-b text-[11px] font-semibold flex items-center gap-2 ${isDark ? 'border-[#333]' : 'border-gray-200'}`}>
            <Users size={13} />
            Participants ({participants.length})
          </div>
          <div className="p-2 space-y-1">
            {participants.length === 0 ? (
              <div className="text-[11px] opacity-60 px-2 py-1">No active participants</div>
            ) : (
              participants.map((p) => (
                <div key={String(p._id)} className={`rounded-md px-2 py-2 text-xs border ${isDark ? 'border-white/10 bg-[#151925]' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{p.username}</div>
                    <div className="opacity-60 uppercase text-[10px]">{p.role || 'editor'}</div>
                  </div>
                  <div className="mt-1 text-[10px] opacity-60">
                    {p.currentFile ? `Editing ${p.currentFile}` : (p.currentTask || 'Idle')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`rounded-lg border glass-card ${isDark ? 'border-white/10 bg-[#1c2130]/80' : 'border-gray-200 bg-white/90'}`}>
          <div className={`px-3 py-2 border-b text-[11px] font-semibold flex items-center gap-2 ${isDark ? 'border-[#333]' : 'border-gray-200'}`}>
            <MessageSquare size={13} />
            Room Chat ({messages.length})
          </div>
          <div className="p-2 space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
            {messages.length === 0 ? (
              <div className="text-[11px] opacity-60 px-2 py-1">No messages yet</div>
            ) : (
              messages.map((m) => (
                <div key={String(m._id)} className={`rounded-md px-2 py-2 text-xs border ${isDark ? 'border-white/10 bg-[#151925]' : 'border-gray-200 bg-white'}`}>
                  <div className="font-semibold">{m.senderName}</div>
                  <div className="mt-1 opacity-80 whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              ))
            )}
          </div>
          <div className={`p-2 border-t ${isDark ? 'border-[#333]' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <input
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendRoomMessage();
                  }
                }}
                placeholder={roomId ? 'Type a message' : 'Join a room to chat'}
                disabled={!roomId || !canUseCollab}
                className={`flex-1 h-9 px-3 rounded-md border text-xs ${
                  isDark ? 'bg-[#252526] border-[#3a3a3a] text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'
                } disabled:opacity-50`}
              />
              <button
                onClick={() => { void sendRoomMessage(); }}
                disabled={!roomId || !messageDraft.trim() || !canUseCollab}
                className="h-9 w-9 rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center"
                title="Send message"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`px-4 py-2 text-[10px] border-t ${isDark ? 'border-white/10 bg-black/20 text-gray-500' : 'border-gray-200 bg-white/70 text-gray-500'}`}>
        {roomId && room ? 'Connected to active room' : 'Create or join a room to start collaborating'}
      </div>
    </div>
  );
};
