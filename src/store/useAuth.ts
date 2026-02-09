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
  joinedAt: number;
  stats: UserStats;
  friends: string[]; // List of friend IDs
  servers: string[]; // List of joined server IDs
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  showAuth: boolean;
  showProfile: boolean;
  registeredUsers: Record<string, UserProfile & { password: string }>; // Simulating DB
  
  // Actions
  setShowAuth: (show: boolean) => void;
  setShowProfile: (show: boolean) => void;
  loginAsGuest: (username?: string) => void;
  login: (username: string, password: string) => boolean; // Returns success
  signUp: (username: string, password: string, bio?: string) => boolean; // Returns success
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  upgradeToPro: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      showAuth: false,
      showProfile: false,
      registeredUsers: {},

      setShowAuth: (show) => set({ showAuth: show }),
      setShowProfile: (show) => set({ showProfile: show }),

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
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestName}`
        };
        set({ user: guestUser, isAuthenticated: true });
      },

      login: (username, password) => {
        const { registeredUsers } = get();
        const userEntry = Object.values(registeredUsers).find(u => u.username === username && u.password === password);
        
        if (userEntry) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { password: _, ...profile } = userEntry;
          set({ user: profile, isAuthenticated: true });
          return true;
        }
        return false;
      },

      signUp: (username, password, bio) => {
        const { registeredUsers } = get();
        if (Object.values(registeredUsers).some(u => u.username === username)) {
          return false; // User exists
        }

        const newUser: UserProfile = {
          id: `user-${uuidv4()}`,
          username,
          isGuest: false,
          isPro: false,
          bio,
          isVerified: false,
          joinedAt: Date.now(),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          banner: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80',
          stats: { problemsSolved: 0, streak: 1, rank: 'Cadet', xp: 100 },
          friends: [],
          servers: ['global'],
        };

        set({ 
          registeredUsers: { ...registeredUsers, [newUser.id]: { ...newUser, password } },
          user: newUser, 
          isAuthenticated: true 
        });
        return true;
      },

      logout: () => set({ user: null, isAuthenticated: false }),

      updateProfile: (updates) =>
        set((state) => {
          const updatedUser = state.user ? { ...state.user, ...updates } : null;
          // Update in DB too if not guest
          let newRegistry = state.registeredUsers;
          if (updatedUser && !updatedUser.isGuest) {
             const entry = newRegistry[updatedUser.id];
             if (entry) {
               newRegistry = { ...newRegistry, [updatedUser.id]: { ...entry, ...updates } };
             }
          }
          return { user: updatedUser, registeredUsers: newRegistry };
        }),

      upgradeToPro: () => 
        set((state) => {
          const updatedUser = state.user ? { ...state.user, isPro: true } : null;
          let newRegistry = state.registeredUsers;
          if (updatedUser && !updatedUser.isGuest) {
             const entry = newRegistry[updatedUser.id];
             if (entry) {
               newRegistry = { ...newRegistry, [updatedUser.id]: { ...entry, isPro: true } };
             }
          }
          return { user: updatedUser, registeredUsers: newRegistry };
        }),
    }),
    {
      name: 'syntaxark-auth',
    }
  )
);
