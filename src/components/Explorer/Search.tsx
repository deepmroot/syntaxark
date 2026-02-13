import React, { useMemo, useState } from 'react';
import { Search as SearchIcon, UserPlus, UserCircle } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../store/useAuth';
import { PublicUserProfileModal } from '../Profile/PublicUserProfileModal';

export const Search: React.FC = () => {
  const { user, setShowAuth, setShowProfile } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const apiAny = api as any;
  const addFriend = useMutation(apiAny.users.addFriend);
  const removeFriend = useMutation(apiAny.users.removeFriend);
  const startDmThread = useMutation(apiAny.chat.startDmThread);
  const myFriends = useQuery(apiAny.users.getMyFriends, user && !user.isGuest ? {} : 'skip') || [];
  const userResults = useQuery(
    apiAny.users.searchUsers,
    query.trim().length >= 2 && user && !user.isGuest ? { query } : 'skip',
  ) || [];
  const selectedProfile = useQuery(
    apiAny.users.getPublicProfile,
    selectedUserId && user && !user.isGuest ? { userId: selectedUserId as any } : 'skip',
  );

  const visibleFriends = useMemo(() => {
    if (!query.trim()) return myFriends;
    const q = query.toLowerCase();
    return myFriends.filter((f: any) =>
      String(f.username || '').toLowerCase().includes(q) ||
      String(f.email || '').toLowerCase().includes(q),
    );
  }, [myFriends, query]);

  const requireAuth = () => {
    if (!user || user.isGuest) {
      setShowAuth(true);
      return false;
    }
    return true;
  };

  const withFeedback = (text: string) => {
    setActionFeedback(text);
    window.setTimeout(() => setActionFeedback(''), 1800);
  };

  return (
    <div className="h-full bg-[#141417]/50 backdrop-blur-xl flex flex-col select-none overflow-hidden relative border-r border-white/5">
      <div className="p-4 uppercase text-[10px] font-black text-gray-500 tracking-[0.3em] border-b border-white/5 bg-white/5">
        Search Users
      </div>
      <div className="p-6 space-y-4 bg-white/[0.02] border-b border-white/5">
        <div className="relative group">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-400 transition-colors" />
          <input 
            autoFocus
            className="ethereal-input w-full h-10 pl-10 pr-4 text-xs font-bold uppercase tracking-widest"
            placeholder="SEARCH USERS..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {actionFeedback && (
          <div className="px-4 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] animate-in fade-in slide-in-from-top-1">
            {actionFeedback}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="mb-8">
          <div className="px-2 mb-3 text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Friends
          </div>
          {!user || user.isGuest ? (
            <div className="px-4 py-6 rounded-2xl glass-card border-dashed text-center">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-relaxed">
                Sign in to manage your friends list.
              </p>
            </div>
          ) : visibleFriends.length > 0 ? (
            <div className="space-y-2">
              {visibleFriends.map((u: any) => (
                <button
                  key={u._id}
                  onClick={() => setSelectedUserId(String(u._id))}
                  className="w-full text-left glass-card p-3 flex items-center justify-between group hover:border-white/10 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}`}
                        className="w-9 h-9 rounded-xl border border-white/10"
                        alt=""
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || 'user')}`; }}
                      />
                      <span className={`absolute -right-1 -bottom-1 w-3 h-3 rounded-full border-[3px] border-[#1a1a1e] ${u.isOnline ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-gray-200 uppercase tracking-wider truncate">{u.username}</div>
                      <div className={`text-[8px] font-black uppercase tracking-widest ${u.isOnline ? 'text-emerald-500/60' : 'text-gray-600'}`}>
                        {u.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </div>
                    </div>
                  </div>
                  <UserCircle size={16} className="text-gray-700 group-hover:text-blue-400 transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 opacity-20 select-none">
              <UserPlus size={32} className="mx-auto mb-2" strokeWidth={1} />
              <p className="text-[9px] font-black uppercase tracking-widest">No friends yet</p>
            </div>
          )}
        </div>

        {query.trim().length >= 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="px-2 mb-3 text-[9px] font-black uppercase tracking-[0.3em] text-gray-600">Find People</div>
            {userResults.length > 0 ? (
              <div className="space-y-2">
                {userResults.map((u: any) => (
                  <div key={u._id} className="glass-card p-3 flex items-center justify-between group">
                    <button className="flex items-center gap-3 min-w-0 flex-1 text-left" onClick={() => setSelectedUserId(String(u._id))}>
                      <div className="relative shrink-0">
                        <img
                          src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}`}
                          className="w-9 h-9 rounded-xl border border-white/10"
                          alt=""
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || 'user')}`; }}
                        />
                        <span className={`absolute -right-1 -bottom-1 w-3 h-3 rounded-full border-[3px] border-[#1a1a1e] ${u.isOnline ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black text-gray-200 uppercase tracking-wider truncate">{u.username}</div>
                        <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest truncate">{u.email || 'HIDDEN'}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        if (!requireAuth()) return;
                        void addFriend({ friendId: u._id }).then(() => withFeedback(`Added ${u.username}`));
                      }}
                      disabled={Boolean(u.isFriend)}
                      className={`h-8 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                        u.isFriend 
                          ? 'bg-white/5 text-gray-600 cursor-default' 
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-90'
                      }`}
                    >
                      {u.isFriend ? 'FRIEND' : 'ADD'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 opacity-20">
                <p className="text-[9px] font-black uppercase tracking-widest">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedUserId && (
        <PublicUserProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedUserId(null)}
          onAddFriend={async () => {
            if (!selectedUserId || !requireAuth()) return;
            await addFriend({ friendId: selectedUserId as any });
            withFeedback('Friend added');
          }}
          onRemoveFriend={async () => {
            if (!selectedUserId || !requireAuth()) return;
            await removeFriend({ friendId: selectedUserId as any });
            withFeedback('Friend removed');
          }}
          onSendMessage={async () => {
            if (!selectedUserId || !requireAuth()) return;
            const threadId = await startDmThread({ otherUserId: selectedUserId as any });
            window.dispatchEvent(new CustomEvent('syntaxark:navigate', { detail: { tab: 'community' } }));
            window.dispatchEvent(new CustomEvent('syntaxark:open-dm', { detail: { threadId: String(threadId) } }));
            withFeedback('DM thread ready');
          }}
          onOpenOwnProfile={() => setShowProfile(true)}
          isLoggedIn={Boolean(user && !user.isGuest)}
        />
      )}
    </div>
  );
};
