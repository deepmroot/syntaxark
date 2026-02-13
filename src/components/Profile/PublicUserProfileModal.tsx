import React from "react";
import { X, Users, FolderGit2, MessageSquare } from "lucide-react";

type PublicProfileData = {
  user: {
    _id: string;
    username: string;
    avatar?: string;
    banner?: string;
    bio?: string;
    isPro?: boolean;
    stats?: {
      problemsSolved: number;
      streak: number;
      rank: string;
      xp: number;
    };
  };
  friends: Array<{ _id: string; username: string; avatar?: string; isPro?: boolean }>;
  recentProjects: Array<{ _id: string; path: string; updatedAt: number }>;
  recentPosts: Array<{ _id: string; title: string; type: string; likes: number; timestamp: number }>;
  counts: {
    friends: number;
    projects: number;
    posts: number;
    submissions?: number;
    acceptedSubmissions?: number;
    solvedChallenges?: number;
    totalTries?: number;
  };
  relationship: { isSelf: boolean; isFriend: boolean };
};

export const PublicUserProfileModal: React.FC<{
  profile: PublicProfileData | null | undefined;
  onClose: () => void;
  onAddFriend: () => Promise<void>;
  onRemoveFriend: () => Promise<void>;
  onSendMessage: () => Promise<void>;
  onOpenOwnProfile: () => void;
  isLoggedIn: boolean;
}> = ({
  profile,
  onClose,
  onAddFriend,
  onRemoveFriend,
  onSendMessage,
  onOpenOwnProfile,
  isLoggedIn,
}) => {
  if (profile === undefined) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="w-full max-w-3xl rounded-[32px] glass-panel p-8 sm:p-12 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-300 border-white/10">
          <div className="w-12 h-12 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Retrieving Neural Profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const { user, friends, recentProjects, recentPosts, counts, relationship } = profile;
  const stats = user.stats || { problemsSolved: 0, streak: 1, rank: "Cadet", xp: 100 };
  const fallbackBanner = "linear-gradient(135deg, rgba(14,165,233,0.4), rgba(99,102,241,0.4))";

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[92vh] overflow-hidden glass-panel shadow-2xl animate-in zoom-in-95 duration-300 border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="h-44 sm:h-52 relative group">
          {user.banner ? (
            <img src={user.banner} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
          ) : (
            <div className="w-full h-full" style={{ background: fallbackBanner }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center glass-panel border-white/20 rounded-xl text-white hover:bg-white/10 transition-all group/close"
          >
            <X size={20} className="group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="px-4 sm:px-10 pb-8 sm:pb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between -mt-16 mb-8 relative z-10 gap-4">
            <div className="flex items-end gap-4 sm:gap-5 min-w-0">
              <div className="relative group/avatar">
                <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                <img
                  src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}`}
                  className="w-32 h-32 rounded-[40px] border-8 shadow-2xl relative z-10 object-cover border-[#141417] bg-[#1a1a1e]"
                  alt={user.username}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username || 'user')}`; }}
                />
              </div>
              <div className="pb-3">
                <h1 className="text-2xl font-black uppercase tracking-tighter text-white">{user.username}</h1>
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-400 mt-1">
                  {stats.rank} <span className="text-gray-600 ml-2">Protocol Layer</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 mb-2 flex-wrap">
              {relationship.isSelf ? (
                <button 
                  onClick={onOpenOwnProfile} 
                  className="px-4 h-9 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.16em] flex items-center gap-2 hover:bg-white/10 hover:border-white/10 transition-all active:scale-95"
                >
                  <Users size={14} /> My Neural Profile
                </button>
              ) : (
                <>
                  {isLoggedIn && (
                    <button
                      onClick={() => { void onSendMessage(); }}
                      className="px-4 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-[0.16em] shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center gap-2 active:scale-95"
                    >
                      <MessageSquare size={14} /> DM
                    </button>
                  )}
                  {isLoggedIn &&
                    (relationship.isFriend ? (
                      <button
                        onClick={() => { void onRemoveFriend(); }}
                        className="px-4 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-[0.16em] hover:bg-rose-500/20 transition-all active:scale-95"
                      >
                        Disconnect Link
                      </button>
                    ) : (
                      <button
                        onClick={() => { void onAddFriend(); }}
                        className="px-4 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-[0.16em] shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 active:scale-95"
                      >
                        Establish Link
                      </button>
                    ))}
                </>
              )}
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl mb-8 border-white/5">
            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 ml-1 mb-2 block">Identity Intelligence</label>
            <p className="text-[13px] text-gray-400 font-medium leading-relaxed">
              {user.bio || "No biological intelligence data transmitted."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
      { label: 'Solved', val: counts.solvedChallenges ?? stats.problemsSolved, sub: `From ${counts.totalTries || 0} Attempts` },
              { label: 'Uptime', val: `${stats.streak} Days`, sub: 'Neural Sync' },
              { label: 'Experience', val: stats.xp, sub: 'Total Credits' },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-5 rounded-3xl border-white/5">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 mb-1">{stat.label}</div>
                <div className="text-xl font-black text-white mb-1">{stat.val}</div>
                <div className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">{stat.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[10px] font-bold uppercase tracking-widest">
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1 text-gray-500">
                <Users size={14} className="text-blue-500/60" /> 
                <span className="font-black">Network ({counts.friends})</span>
              </div>
              <div className="space-y-2">
                {friends.length > 0 ? (
                  friends.slice(0, 4).map((friend) => (
                    <div key={friend._id} className="flex items-center gap-2 group">
                      <img
                        src={friend.avatar || `https://ui-avatars.com/api/?name=${friend.username}`}
                        className="w-5 h-5 rounded-md opacity-60 group-hover:opacity-100 transition-opacity"
                        alt=""
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(friend.username || 'user')}`; }}
                      />
                      <span className="text-gray-400 group-hover:text-white transition-colors truncate">{friend.username}</span>
                    </div>
                  ))
                ) : (
                    <div className="text-gray-700 italic tracking-normal px-1">No data</div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1 text-gray-500">
                <FolderGit2 size={14} className="text-purple-500/60" /> 
                <span className="font-black">Segments ({counts.projects})</span>
              </div>
              <div className="space-y-2">
                {recentProjects.length > 0 ? (
                  recentProjects.slice(0, 4).map((project) => (
                    <div key={project._id} className="text-gray-400 hover:text-white transition-colors truncate px-1 cursor-help" title={project.path}>
                      {project.path}
                    </div>
                  ))
                ) : (
                    <div className="text-gray-700 italic tracking-normal px-1">No data</div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1 text-gray-500">
                <MessageSquare size={14} className="text-emerald-500/60" /> 
                <span className="font-black">Broadcasts ({counts.posts})</span>
              </div>
              <div className="space-y-2">
                {recentPosts.length > 0 ? (
                  recentPosts.slice(0, 4).map((post) => (
                    <div key={post._id} className="text-gray-400 hover:text-white transition-colors truncate px-1 cursor-help" title={post.title}>
                      {post.title}
                    </div>
                  ))
                ) : (
                    <div className="text-gray-700 italic tracking-normal px-1">No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
