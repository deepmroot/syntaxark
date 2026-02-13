import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface UserStats {
  problemsSolved: number;
  streak: number;
  rank: string;
  xp: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  banner?: string;
  isGuest: boolean;
  isPro: boolean;
  isVerified: boolean;
  bio?: string;
  preferredLanguage?: string;
  joinedAt: number;
  stats: UserStats;
  friends: string[]; // List of friend IDs
  servers: string[]; // List of joined server IDs
}

interface AuthUserInput {
  id: string;
  username?: string;
  email?: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  preferredLanguage?: string;
  isPro?: boolean;
  isVerified?: boolean;
  stats?: Partial<UserStats>;
  friends?: string[];
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  showAuth: boolean;
  showProfile: boolean;
  
  // Actions
  setShowAuth: (show: boolean) => void;
  setShowProfile: (show: boolean) => void;
  setAuthenticatedUser: (user: AuthUserInput) => void;
  loginAsGuest: (username?: string) => void;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  upgradeToPro: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      showAuth: false,
      showProfile: false,

      setShowAuth: (show) => set({ showAuth: show }),
      setShowProfile: (show) => set({ showProfile: show }),
      setAuthenticatedUser: (incoming) => {
        const username = incoming.username?.trim() || incoming.email?.split('@')[0] || 'user';
        set({
          user: {
            id: incoming.id,
            username,
            email: incoming.email,
            avatar: incoming.avatar,
            banner: incoming.banner,
            bio: incoming.bio,
            preferredLanguage: incoming.preferredLanguage || 'javascript',
            isGuest: false,
            isPro: incoming.isPro ?? false,
            isVerified: incoming.isVerified ?? false,
            joinedAt: Date.now(),
            stats: {
              problemsSolved: incoming.stats?.problemsSolved ?? 0,
              streak: incoming.stats?.streak ?? 0,
              rank: incoming.stats?.rank ?? 'Cadet',
              xp: incoming.stats?.xp ?? 100,
            },
            friends: incoming.friends ?? [],
            servers: ['global'],
          },
          isAuthenticated: true,
        });
      },

      loginAsGuest: (username) => {
        const guestName = username || `Guest-${Math.floor(Math.random() * 1000)}`;
        const guestUser: UserProfile = {
          id: `guest-${uuidv4()}`,
          username: guestName,
          email: `${guestName.toLowerCase()}@guest.local`, // Dummy email for type compatibility
          isGuest: true,
          isPro: false,
          isVerified: false,
          joinedAt: Date.now(),
          stats: { problemsSolved: 0, streak: 0, rank: 'Visitor', xp: 0 },
          friends: [],
          servers: ['global'],
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestName}`,
          preferredLanguage: 'javascript',
        };
        set({ user: guestUser, isAuthenticated: true });
      },

      logout: () => set({ user: null, isAuthenticated: false }),

      updateProfile: (updates) =>
        set((state) => {
          const updatedUser = state.user ? { ...state.user, ...updates } : null;
          return { user: updatedUser };
        }),

      upgradeToPro: () => 
        set((state) => {
          const updatedUser = state.user ? { ...state.user, isPro: true } : null;
          return { user: updatedUser };
        }),
    }),
    {
      name: 'syntaxark-auth',
    }
  )
);
