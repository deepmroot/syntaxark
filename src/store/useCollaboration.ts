import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type UserStatus = 'active' | 'idle' | 'away';

export interface Participant {
  id: string;
  name: string;
  role: string;
  color: string;
  status: UserStatus;
  file?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface CollaborationState {
  me: Participant;
  peers: Record<string, Participant>;
  messages: ChatMessage[];
  isLive: boolean;
  channel: BroadcastChannel | null;
  
  // Actions
  goLive: () => void;
  goOffline: () => void;
  updateMyStatus: (status: Partial<Participant>) => void;
  sendMessage: (text: string) => void;
  clearMessages: () => void;
}

// Helpers for random identity
const ROLES = ['Dev', 'Designer', 'Lead', 'Guest', 'Reviewer'];
const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];
const NAMES = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Quinn', 'Skyler'];

const generateIdentity = (): Participant => ({
  id: uuidv4(),
  name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${Math.floor(Math.random() * 100)}`,
  role: ROLES[Math.floor(Math.random() * ROLES.length)],
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  status: 'active',
});

export const useCollaboration = create<CollaborationState>((set, get) => ({
  me: generateIdentity(),
  peers: {},
  messages: [],
  isLive: false,
  channel: null,

  goLive: () => {
    if (get().channel) return;

    const channel = new BroadcastChannel('syntaxark-collab');
    const { me } = get();

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      const state = get();

      switch (type) {
        case 'HELLO':
          // A new peer joined. Register them and say hello back so they know about me.
          if (payload.id !== me.id) {
            set((s) => ({ peers: { ...s.peers, [payload.id]: payload } }));
            channel.postMessage({ type: 'WELCOME', payload: state.me });
            set((s) => ({
              messages: [...s.messages, {
                id: uuidv4(),
                senderId: 'system',
                senderName: 'System',
                text: `${payload.name} joined the session.`,
                timestamp: Date.now(),
                isSystem: true
              }]
            }));
          }
          break;

        case 'WELCOME':
          // Existing peer responded to my hello. Register them.
          if (payload.id !== me.id) {
            set((s) => ({ peers: { ...s.peers, [payload.id]: payload } }));
          }
          break;

        case 'UPDATE_PEER':
          if (payload.id !== me.id) {
            set((s) => ({ peers: { ...s.peers, [payload.id]: { ...s.peers[payload.id], ...payload } } }));
          }
          break;

        case 'CHAT':
          set((s) => ({ messages: [...s.messages, payload] }));
          break;

        case 'LEAVE':
          if (payload.id) {
            set((s) => {
              const newPeers = { ...s.peers };
              const name = newPeers[payload.id]?.name || 'Unknown';
              delete newPeers[payload.id];
              return {
                peers: newPeers,
                messages: [...s.messages, {
                  id: uuidv4(),
                  senderId: 'system',
                  senderName: 'System',
                  text: `${name} left.`,
                  timestamp: Date.now(),
                  isSystem: true
                }]
              };
            });
          }
          break;
      }
    };

    // Announce self
    channel.postMessage({ type: 'HELLO', payload: me });

    set({ isLive: true, channel });
  },

  goOffline: () => {
    const { channel, me } = get();
    if (channel) {
      channel.postMessage({ type: 'LEAVE', payload: { id: me.id } });
      channel.close();
    }
    set({ isLive: false, channel: null, peers: {}, messages: [] });
  },

  updateMyStatus: (status) => {
    const { me, channel } = get();
    const newMe = { ...me, ...status };
    set({ me: newMe });
    if (channel) {
      channel.postMessage({ type: 'UPDATE_PEER', payload: newMe });
    }
  },

  sendMessage: (text) => {
    const { me, channel, isLive } = get();
    if (!text.trim()) return;
    
    // If not live, just local echo or warn? Let's auto-go-live or just show local.
    // For this UX, we'll assume chat works locally if offline (notes) or syncs if online.
    
    const msg: ChatMessage = {
      id: uuidv4(),
      senderId: me.id,
      senderName: me.name,
      text: text.trim(),
      timestamp: Date.now(),
    };

    set((s) => ({ messages: [...s.messages, msg] }));

    if (isLive && channel) {
      channel.postMessage({ type: 'CHAT', payload: msg });
    }
  },

  clearMessages: () => set({ messages: [] }),
}));
