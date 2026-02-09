import React, { useState } from 'react';
import { useAuth } from '../../store/useAuth';
import { useEditor } from '../../store/useEditor';
import { X, Crown, Camera, Zap, Trophy, Flame, Users, LogOut, Edit2 } from 'lucide-react';

export const UserProfileModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, updateProfile, upgradeToPro, logout } = useAuth();
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';
  
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [banner, setBanner] = useState(user?.banner || '');

  if (!user) return null;

  const handleSave = () => {
    updateProfile({ bio, banner });
    setIsEditing(false);
  };

  const handleUpgrade = () => {
    const confirmed = window.confirm("Confirm payment of $4.00 for SyntaxArk Pro?");
    if (confirmed) {
      upgradeToPro();
      alert("Welcome to Pro! Cloud sync enabled.");
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl ${isDark ? 'bg-[#1e1e1e] text-gray-200' : 'bg-white text-gray-800'}`}>
        
        {/* Banner */}
        <div className="h-40 relative bg-gray-700">
          <img src={banner} className="w-full h-full object-cover" alt="Banner" />
          {isEditing && (
            <button 
              className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white hover:bg-black/70"
              onClick={() => {
                const url = prompt("Enter new banner URL:", banner);
                if (url) setBanner(url);
              }}
            >
              <Camera size={16} />
            </button>
          )}
          <button onClick={onClose} className="absolute top-4 left-4 bg-black/50 p-2 rounded-full text-white hover:bg-black/70">
            <X size={16} />
          </button>
        </div>

        {/* Header Content */}
        <div className="px-8 pb-8">
          <div className="flex justify-between items-end -mt-12 mb-6">
            <div className="relative">
              <img 
                src={user.avatar} 
                className={`w-24 h-24 rounded-full border-4 ${isDark ? 'border-[#1e1e1e]' : 'border-white'}`}
                alt="Avatar"
              />
              {user.isPro && (
                <div className="absolute bottom-1 right-1 bg-yellow-500 text-black p-1 rounded-full border-2 border-[#1e1e1e]" title="Pro Member">
                  <Crown size={14} fill="currentColor" />
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              {user.isPro ? (
                <div className="px-4 py-2 rounded-lg bg-yellow-500/10 text-yellow-500 text-xs font-bold border border-yellow-500/20 flex items-center gap-2">
                  <Crown size={14} /> PRO MEMBER
                </div>
              ) : (
                <button 
                  onClick={handleUpgrade}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-600 to-yellow-500 text-white text-xs font-bold shadow-lg hover:shadow-yellow-500/20 transition-all flex items-center gap-2"
                >
                  <Zap size={14} /> UPGRADE TO PRO ($4)
                </button>
              )}
              
              {isEditing ? (
                <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">
                  Save Changes
                </button>
              ) : (
                <button onClick={() => setIsEditing(true)} className={`px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 ${isDark ? 'border-[#444] hover:bg-[#333]' : 'border-gray-200 hover:bg-gray-100'}`}>
                  <Edit2 size={14} /> Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {user.username} 
              <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${isDark ? 'bg-[#333] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                {user.stats.rank}
              </span>
            </h1>
            <div className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {isEditing ? (
                <textarea 
                  className={`w-full p-2 rounded border outline-none ${isDark ? 'bg-[#252526] border-[#444]' : 'bg-gray-50 border-gray-200'}`}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={2}
                />
              ) : (
                user.bio || 'No bio yet.'
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                <Trophy size={14} className="text-yellow-500" /> Solved
              </div>
              <div className="text-2xl font-bold">{user.stats.problemsSolved}</div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                <Flame size={14} className="text-orange-500" /> Streak
              </div>
              <div className="text-2xl font-bold">{user.stats.streak} Days</div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                <Users size={14} className="text-blue-500" /> Friends
              </div>
              <div className="text-2xl font-bold">{user.friends.length}</div>
            </div>
          </div>

          {/* Settings / Danger Zone */}
          <div className={`pt-6 border-t ${isDark ? 'border-[#333]' : 'border-gray-200'}`}>
            <button 
              onClick={() => { logout(); onClose(); }}
              className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-400 transition-colors"
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
