import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type PostType = 'challenge' | 'showcase' | 'collab-invite' | 'discussion';

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  type: PostType;
  title: string;
  content: string; // Markdown supported
  codeSnippet?: string; // Optional code to show off
  language?: string;
  likes: number;
  comments: Comment[];
  timestamp: number;
  tags: string[];
}

interface CommunityState {
  posts: Post[];
  showCreatePost: boolean;
  
  // Actions
  setShowCreatePost: (show: boolean) => void;
  createPost: (post: Omit<Post, 'id' | 'likes' | 'comments' | 'timestamp'>) => void;
  likePost: (postId: string) => void;
  addComment: (postId: string, authorId: string, authorName: string, text: string) => void;
  deletePost: (postId: string) => void;
}

const INITIAL_POSTS: Post[] = [
  {
    id: '1',
    authorId: 'system',
    authorName: 'SyntaxArk Bot',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ark',
    type: 'challenge',
    title: 'Daily Challenge: Reverse a Linked List',
    content: 'Can you implement a function to reverse a singly linked list in O(n) time using O(1) space?',
    codeSnippet: 'function reverseList(head) {\n  // Your code here\n}',
    language: 'javascript',
    likes: 42,
    comments: [],
    timestamp: Date.now() - 86400000,
    tags: ['algorithms', 'medium'],
  },
  {
    id: '2',
    authorId: 'user-demo',
    authorName: 'AlexDev',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    type: 'collab-invite',
    title: 'Building a React Dashboard - Need Help!',
    content: 'Hey everyone! I am working on a dashboard component and getting stuck with grid layouts. Join my room if you want to pair program.',
    timestamp: Date.now() - 3600000,
    likes: 5,
    comments: [],
    tags: ['react', 'help-wanted'],
  }
];

export const useCommunity = create<CommunityState>()(
  persist(
    (set) => ({
      posts: INITIAL_POSTS,
      showCreatePost: false,

      setShowCreatePost: (show) => set({ showCreatePost: show }),

      createPost: (postData) => {
        const newPost: Post = {
          ...postData,
          id: uuidv4(),
          likes: 0,
          comments: [],
          timestamp: Date.now(),
        };
        set((state) => ({ posts: [newPost, ...state.posts] }));
      },

      likePost: (postId) =>
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === postId ? { ...p, likes: p.likes + 1 } : p
          ),
        })),

      addComment: (postId, authorId, authorName, text) =>
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  comments: [
                    ...p.comments,
                    {
                      id: uuidv4(),
                      authorId,
                      authorName,
                      text,
                      timestamp: Date.now(),
                    },
                  ],
                }
              : p
          ),
        })),
        
      deletePost: (postId) =>
        set((state) => ({
            posts: state.posts.filter(p => p.id !== postId)
        })),
    }),
    {
      name: 'syntaxark-community',
    }
  )
);
