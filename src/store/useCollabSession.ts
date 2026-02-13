import { create } from 'zustand';

interface CollabSessionState {
  roomId: string | null;
  roomCode: string;
  setSession: (roomId: string, roomCode: string) => void;
  clearSession: () => void;
}

export const useCollabSession = create<CollabSessionState>((set) => ({
  roomId: null,
  roomCode: '',
  setSession: (roomId, roomCode) => set({ roomId, roomCode }),
  clearSession: () => set({ roomId: null, roomCode: '' }),
}));

