import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'announcement';
  description?: string;
}

export interface Server {
  id: string;
  name: string;
  icon: string;
  channels: Channel[];
  inviteCode: string;
}

export interface ChatMessage {
  id: string;
  serverId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  timestamp: number;
  attachments?: string[]; // URLs
  reactions: Record<string, number>; // emoji -> count
  isSystem?: boolean;
}

interface DiscordState {
  servers: Server[];
  activeServerId: string;
  activeChannelId: string;
  messages: Record<string, ChatMessage[]>; // channelId -> messages
  
  setActiveServer: (id: string) => void;
  setActiveChannel: (id: string) => void;
  sendMessage: (channelId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'reactions' | 'serverId' | 'channelId'>) => void;
  addReaction: (channelId: string, messageId: string, emoji: string) => void;
  createServer: (name: string, icon?: string) => void;
  joinServer: (inviteCode: string) => boolean;
}

const INITIAL_SERVERS: Server[] = [
  {
    id: 'global',
    name: 'SyntaxArk Global',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=SA&backgroundColor=3b82f6',
    inviteCode: 'syntax-global',
    channels: [
      { id: 'gen', name: 'general', type: 'text', description: 'Talk about anything' },
      { id: 'ann', name: 'announcements', type: 'announcement', description: 'Platform updates' },
      { id: 'help', name: 'help-desk', type: 'text', description: 'Get coding help' },
      { id: 'show', name: 'showcase', type: 'text', description: 'Show off your projects' },
    ]
  },
  {
    id: 'react',
    name: 'React Developers',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=RD&backgroundColor=61dafb',
    inviteCode: 'react-devs',
    channels: [
      { id: 'react-gen', name: 'react-general', type: 'text' },
      { id: 'hooks', name: 'hooks', type: 'text' },
    ]
  }
];

export const useDiscord = create<DiscordState>()(
  persist(
    (set, get) => ({
      servers: INITIAL_SERVERS,
      activeServerId: 'global',
      activeChannelId: 'gen',
      messages: {
        'gen': [
          {
            id: '1',
            serverId: 'global',
            channelId: 'gen',
            authorId: 'sys',
            authorName: 'System',
            authorAvatar: '',
            content: 'Welcome to the global chat! Be nice.',
            timestamp: Date.now() - 100000,
            reactions: {},
            isSystem: true
          }
        ]
      },

      setActiveServer: (id) => {
        const server = get().servers.find(s => s.id === id);
        if (server) {
          set({ activeServerId: id, activeChannelId: server.channels[0].id });
        }
      },

      setActiveChannel: (id) => set({ activeChannelId: id }),

      sendMessage: (channelId, msgData) => {
        const msg: ChatMessage = {
          ...msgData,
          id: uuidv4(),
          serverId: get().activeServerId,
          channelId,
          timestamp: Date.now(),
          reactions: {},
        };
        set(state => ({
          messages: {
            ...state.messages,
            [channelId]: [...(state.messages[channelId] || []), msg]
          }
        }));
      },

      addReaction: (channelId, messageId, emoji) => {
        set(state => {
          const msgs = state.messages[channelId] || [];
          return {
            messages: {
              ...state.messages,
              [channelId]: msgs.map(m => {
                if (m.id === messageId) {
                  const current = m.reactions[emoji] || 0;
                  return { ...m, reactions: { ...m.reactions, [emoji]: current + 1 } };
                }
                return m;
              })
            }
          };
        });
      },

      createServer: (name, icon) => {
        const newServerId = uuidv4();
        const defaultChannelId = uuidv4();
        const newServer: Server = {
          id: newServerId,
          name,
          icon: icon || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
          inviteCode: uuidv4().slice(0, 8),
          channels: [
            { id: defaultChannelId, name: 'general', type: 'text' }
          ]
        };
        
        set(state => ({
          servers: [...state.servers, newServer],
          activeServerId: newServerId,
          activeChannelId: defaultChannelId,
          messages: {
            ...state.messages,
            [defaultChannelId]: [{
              id: uuidv4(),
              serverId: newServerId,
              channelId: defaultChannelId,
              authorId: 'sys',
              authorName: 'System',
              content: `Welcome to ${name}!`,
              timestamp: Date.now(),
              reactions: {},
              isSystem: true
            }]
          }
        }));
      },

      joinServer: (inviteCode) => {
        // In a real app, this would fetch server data. 
        // Here we simulate joining by checking if it exists in a "public directory" 
        // (which is just our list for now, effectively "switching" to it if we already have it).
        // To make it realistic, we'll pretend we "found" it.
        const server = get().servers.find(s => s.inviteCode === inviteCode);
        if (server) {
          set({ activeServerId: server.id, activeChannelId: server.channels[0].id });
          return true;
        }
        return false;
      }
    }),
    { name: 'syntaxark-discord' }
  )
);
