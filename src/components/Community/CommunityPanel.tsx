import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../store/useAuth';
import { useDiscord } from '../../store/useDiscord';
import { useCommunity, type PostType } from '../../store/useCommunity';
import { useEditor } from '../../store/useEditor';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { 
  Hash, Mic, MicOff, Headphones, HeadphoneOff, Plus, 
  Gift, ImageIcon, Smile, MoreHorizontal, 
  MessageSquare, Heart, Share2, Globe, Trophy, Rocket, Users
} from 'lucide-react';
import Editor from '@monaco-editor/react';

/* ─── Modals ─── */

export const CreatePostModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';
  const createPost = useMutation(api.community.createPost);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('discussion');
  const [tags] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim()) return;
    setLoading(true);
    try {
      await createPost({
        authorId: user.id as any,
        authorName: user.username,
        authorAvatar: user.avatar,
        title, content, type,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        codeSnippet: code.trim() || undefined,
        language: 'javascript'
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-lg rounded-xl border p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-[#1e1e1e] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
        <h2 className="text-xl font-bold mb-4">Create New Post</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['discussion', 'challenge', 'showcase', 'collab-invite'] as PostType[]).map(t => (
                <button key={t} type="button" onClick={() => setType(t)} className={`py-2 rounded-lg text-xs font-medium capitalize border transition-all ${type === t ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'bg-[#252526] border-[#333] hover:bg-[#333]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>{t.replace('-', ' ')}</button>
              ))}
            </div>
          </div>
          <div><label className="block text-xs font-semibold mb-1.5">Title</label><input required className={`w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-[#252526] border-[#333] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} placeholder="What's on your mind?" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold mb-1.5">Content</label><textarea required className={`w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-blue-500 resize-none ${isDark ? 'bg-[#252526] border-[#333] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} placeholder="Describe your post..." rows={4} value={content} onChange={e => setContent(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold mb-1.5">Code (Optional)</label><div className={`h-32 border rounded-lg overflow-hidden ${isDark ? 'border-[#333]' : 'border-gray-200'}`}><Editor height="100%" language="javascript" theme={isDark ? 'vs-dark' : 'light'} value={code} onChange={(val) => setCode(val || '')} options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off' }} /></div></div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${isDark ? 'bg-[#252526] hover:bg-[#333]' : 'bg-gray-100 hover:bg-gray-200'}`}>Cancel</button><button type="submit" disabled={loading} className={`flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors ${loading ? 'opacity-50 cursor-wait' : ''}`}>{loading ? 'Posting...' : 'Post'}</button></div>
        </form>
      </div>
    </div>
  );
};

/* ─── UI Parts ─── */

const PostItem: React.FC<{ post: any }> = ({ post }) => {
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';
  const likePost = useMutation(api.community.likePost);
  const typeIcons: Record<string, React.ReactNode> = {
    challenge: <Trophy size={14} className="text-yellow-500" />,
    showcase: <Rocket size={14} className="text-purple-500" />,
    'collab-invite': <Users size={14} className="text-green-500" />,
    discussion: <MessageSquare size={14} className="text-blue-500" />,
  };

  return (
    <div className={`p-4 rounded-xl border mb-4 transition-all hover:shadow-md ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-white border-gray-100'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <img src={post.authorAvatar || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`} alt={post.authorName} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700" />
          <div><h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{post.title}</h3><div className="flex items-center gap-2 text-[10px] opacity-60"><span>{post.authorName}</span><span>•</span><span className="flex items-center gap-1 capitalize">{typeIcons[post.type] || <MessageSquare size={14} />} {post.type.replace('-', ' ')}</span><span>•</span><span>{new Date(post.timestamp).toLocaleDateString()}</span></div></div>
        </div>
      </div>
      <div className={`text-xs mb-3 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{post.content}</div>
      {post.codeSnippet && <div className={`mb-3 rounded-lg overflow-hidden border ${isDark ? 'border-[#333]' : 'border-gray-200'}`}><div className={`px-3 py-1.5 text-[10px] border-b ${isDark ? 'bg-[#1e1e1e] border-[#333] text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>{post.language || 'text'}</div><Editor height="150px" language={post.language || 'javascript'} value={post.codeSnippet} theme={isDark ? 'vs-dark' : 'light'} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 11, lineNumbers: 'off', folding: false, domReadOnly: true }} /></div>}
      <div className={`flex items-center gap-4 pt-3 border-t text-xs ${isDark ? 'border-[#333] text-gray-400' : 'border-gray-100 text-gray-500'}`}>
        <button onClick={() => likePost({ postId: post._id })} className="flex items-center gap-1.5 hover:text-red-400 transition-colors"><Heart size={14} className={post.likes > 0 ? 'fill-red-400 text-red-400' : ''} />{post.likes}</button>
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors"><MessageSquare size={14} />{post.comments?.length || 0} Comments</button>
        <button className="flex items-center gap-1.5 ml-auto hover:text-green-400 transition-colors"><Share2 size={14} /> Share</button>
      </div>
    </div>
  );
};

const DiscordInterface: React.FC = () => {
  const { activeServerId, activeChannelId, setActiveServer, setActiveChannel } = useDiscord();
  const { user } = useAuth();
  const servers = useQuery(api.chat.getServers) || [];
  const channels = useQuery(api.chat.getChannels, { serverId: activeServerId as any }) || [];
  const channelMessages = useQuery(api.chat.getMessages, { channelId: activeChannelId as any }) || [];
  const sendMessage = useMutation(api.chat.sendMessage);
  const createServer = useMutation(api.chat.createServer);

  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'auto' }); }, [channelMessages, activeChannelId]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !user || !activeChannelId) return;
    await sendMessage({ channelId: activeChannelId as any, authorId: user.id as any, authorName: user.username, authorAvatar: user.avatar, content: inputText.trim() });
    setInputText('');
  };

  const handleCreate = async () => {
    const name = prompt("Enter Server Name:");
    if (name && user) await createServer({ name, ownerId: user.id as any });
  };

  const activeServer = servers.find(s => s._id === activeServerId);
  const activeChannel = channels.find(c => c._id === activeChannelId);

  return (
    <div className="flex h-full w-full bg-[#313338] overflow-hidden font-sans select-none text-[#DBDEE1]">
      <div className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 overflow-y-auto no-scrollbar shrink-0">
        {servers.map(s => (
          <div key={s._id} onClick={() => setActiveServer(s._id)} className="group relative flex items-center justify-center w-[72px] h-12 mb-2 cursor-pointer">
            <div className={`absolute left-0 w-1 rounded-r-lg bg-white transition-all ${s._id === activeServerId ? 'h-8' : 'h-2 opacity-0 group-hover:opacity-100 group-hover:h-5'}`} />
            <div className={`w-12 h-12 rounded-[24px] overflow-hidden transition-all group-hover:rounded-[16px] ${s._id === activeServerId ? '!rounded-[16px]' : ''}`}><img src={s.icon} className="w-full h-full object-cover" alt="" /></div>
          </div>
        ))}
        <div onClick={handleCreate} className="w-12 h-12 rounded-[24px] bg-[#313338] text-green-500 hover:bg-green-600 hover:text-white hover:rounded-[16px] transition-all flex items-center justify-center cursor-pointer mb-2"><Plus size={24} /></div>
      </div>
      <div className="w-60 bg-[#2B2D31] flex flex-col shrink-0">
        <div className="h-12 border-b border-[#1F2023] flex items-center justify-between px-4 hover:bg-[#35373C] cursor-pointer transition-colors shadow-sm">
          <h2 className="font-bold text-white truncate text-[15px]">{activeServer?.name || 'Servers'}</h2>
          <MoreHorizontal size={20} className="text-white" />
        </div>
        <div className="flex-1 overflow-y-auto pt-3">
          {channels.map(c => (
            <div key={c._id} onClick={() => setActiveChannel(c._id)} className={`group flex items-center gap-1.5 px-2 py-1.5 mx-2 rounded-md cursor-pointer transition-colors ${c._id === activeChannelId ? 'bg-[#393c43] text-white' : 'text-[#949BA4] hover:bg-[#35373c] hover:text-[#DBDEE1]'}`}>
              <Hash size={18} /><span className="text-[15px] font-medium truncate">{c.name}</span>
            </div>
          ))}
        </div>
        <div className="h-[52px] bg-[#232428] flex items-center px-2 shrink-0">
          {user ? (
            <div className="flex items-center w-full">
              <div className="relative cursor-pointer mr-2"><img src={user.avatar} className="w-8 h-8 rounded-full" alt="" /><div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#232428]" /></div>
              <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-white truncate">{user.username}</div><div className="text-xs text-[#949BA4] truncate">#{user.id.slice(0, 4)}</div></div>
              <button onClick={() => setMicMuted(!micMuted)} className="p-1.5 hover:bg-[#3F4147] rounded">{micMuted ? <MicOff size={18} className="text-red-400" /> : <Mic size={18} className="text-white" />}</button>
              <button onClick={() => setDeafened(!deafened)} className="p-1.5 hover:bg-[#3F4147] rounded">{deafened ? <HeadphoneOff size={18} className="text-red-400" /> : <Headphones size={18} className="text-white" />}</button>
            </div>
          ) : <div className="text-xs text-[#949BA4] text-center w-full">Sign in to chat</div>}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-[#313338]">
        <div className="h-12 border-b border-[#26272D] flex items-center justify-between px-4 shrink-0 shadow-sm">
          <div className="flex items-center gap-2"><Hash size={24} className="text-[#80848E]" /><h3 className="font-bold text-white">{activeChannel?.name || 'Channel'}</h3></div>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col p-4 space-y-4">
          {[...channelMessages].reverse().map(msg => (
            <div key={msg._id} className="flex gap-4 group">
              <img src={msg.authorAvatar || `https://ui-avatars.com/api/?name=${msg.authorName}`} className="w-10 h-10 rounded-full shrink-0" alt="" />
              <div><div className="flex items-center gap-2"><span className="text-white font-medium hover:underline cursor-pointer">{msg.authorName}</span><span className="text-[11px] text-[#949BA4]">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><p className="text-[#DBDEE1] whitespace-pre-wrap">{msg.content}</p></div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="px-4 pb-6 shrink-0">
          <form onSubmit={handleSend} className="bg-[#383A40] rounded-lg px-4 py-2.5 flex items-center gap-3">
            <button type="button" className="p-1 rounded-full bg-[#B5BAC1] hover:text-white transition-colors text-[#313338]">
              <Plus size={16} strokeWidth={3} />
            </button>
            <input 
              className="flex-1 bg-transparent text-[#DBDEE1] outline-none placeholder-[#949BA4]"
              placeholder={`Message #${activeChannel?.name || ''}`} 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
              disabled={!user || !activeChannel} 
            />
            <div className="flex items-center gap-3 text-[#B5BAC1]">
              <Gift size={24} className="cursor-pointer hover:text-[#DBDEE1]" />
              <ImageIcon size={24} className="cursor-pointer hover:text-[#DBDEE1]" />
              <Smile size={24} className="cursor-pointer hover:text-[#DBDEE1]" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const CommunityPanel: React.FC = () => {
  const { theme } = useEditor();
  const { setShowCreatePost } = useCommunity();
  const { user, isAuthenticated, logout, setShowAuth } = useAuth();
  const posts = useQuery(api.community.getPosts) || [];
  const isDark = theme === 'vs-dark';
  const [view, setView] = useState<'feed' | 'chat'>('feed');
  const [filter, setFilter] = useState<PostType | 'all'>('all');
  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.type === filter);

  if (view === 'chat') {
    if (user?.isGuest) {
      return (
        <div className="h-full flex flex-col bg-[#313338]">
          <div className="h-10 bg-[#1e1e1e] border-b border-[#111] flex items-center justify-between px-4 shrink-0">
            <button onClick={() => setView('feed')} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">← Back to Feed</button>
            <span className="text-xs font-bold text-white text-center flex-1">Community Hub</span>
            <div className="w-10" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Globe size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Join the Conversation</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">Live chat features are exclusive to registered members. Sign up to join servers, chat with friends, and more!</p>
            </div>
            <button 
              onClick={() => setShowAuth(true)}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors"
            >
              Sign Up for Full Access
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-[#313338]">
        <div className="h-10 bg-[#1e1e1e] border-b border-[#111] flex items-center justify-between px-4 shrink-0"><button onClick={() => setView('feed')} className="text-xs text-gray-400 hover:text-white">← Back to Feed</button><span className="text-xs font-bold text-white text-center flex-1">SyntaxArk Community Hub</span><div className="w-10" /></div>
        <div className="flex-1 overflow-hidden"><DiscordInterface /></div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#1e1e1e] text-gray-300' : 'bg-white text-gray-800'}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <div><h2 className="text-sm font-bold">Community</h2><p className="text-[10px] opacity-60">Explore and discuss</p></div>
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2"><img src={user.avatar} className="w-8 h-8 rounded-full border cursor-pointer" onClick={logout} alt="" /></div>
        ) : <button onClick={() => setShowAuth(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-900/20">Sign In</button>}
      </div>
      <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b no-scrollbar">
        <button onClick={() => setView('chat')} className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"><Globe size={12} /> Community Hub</button>
        <button onClick={() => setFilter('all')} className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${filter === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}>All</button>
        {['challenge', 'showcase', 'collab-invite', 'discussion'].map((t: any) => (
          <button key={t} onClick={() => setFilter(t)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-medium border transition-colors capitalize ${filter === t ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}>{t.replace('-', ' ')}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 relative custom-scrollbar">
        {filteredPosts.length > 0 ? filteredPosts.map((p: any) => <PostItem key={p._id} post={p} />) : <div className="text-center opacity-40 mt-20 flex flex-col items-center gap-2"><MessageSquare size={32} /><p className="text-sm font-semibold">No posts found</p></div>}
        <button onClick={() => isAuthenticated ? setShowCreatePost(true) : setShowAuth(true)} className="absolute bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-transform"><Plus size={24} /></button>
      </div>
    </div>
  );
};