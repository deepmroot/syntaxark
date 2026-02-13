import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/useAuth';
import { useEditor } from '../../store/useEditor';
import { Ghost, Mail, Lock, User, Loader2, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from '../../../convex/_generated/api';

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const AuthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { loginAsGuest, setAuthenticatedUser } = useAuth();
  const { signIn } = useAuthActions();
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';
  
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [usernameValid, setUsernameValid] = useState<boolean | null>(null);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const convexLogin = useMutation(api.auth.login);
  const convexSignUp = useMutation(api.auth.signUp);
  const checkUsernameQuery = useQuery(api.auth.checkUsername, username.length >= 3 ? { username } : "skip");
  const checkEmailQuery = useQuery(api.auth.checkEmail, email.includes('@') ? { email } : "skip");

  useEffect(() => {
    if (username.length < 3) { setUsernameValid(null); return; }
    setCheckingUsername(true);
    const timer = setTimeout(() => {
      if (checkUsernameQuery) { setUsernameValid(checkUsernameQuery.available); setCheckingUsername(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [username, checkUsernameQuery]);

  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailValid(null); return; }
    setCheckingEmail(true);
    const timer = setTimeout(() => {
      if (checkEmailQuery) { setEmailValid(checkEmailQuery.available); setCheckingEmail(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [email, checkEmailQuery]);

  useEffect(() => {
    setPasswordValid(password.length === 0 ? null : password.length >= 6);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await convexLogin({ identifier: email, password });
        if (result) {
          setAuthenticatedUser({
            id: result._id,
            username: result.username,
            email: result.email,
            avatar: result.avatar,
            banner: result.banner,
            bio: result.bio,
            preferredLanguage: result.preferredLanguage,
            isPro: result.isPro,
            isVerified: result.isVerified,
            stats: result.stats,
            friends: result.friends as string[] | undefined,
          });
          onClose();
        } else {
          setError('IDENTIFICATION FAILED: INVALID CREDENTIALS');
        }
      } else {
        if (!usernameValid || !emailValid || !passwordValid) { setError('VALIDATION ERROR: PROTOCOL VIOLATION'); setLoading(false); return; }
        const result = await convexSignUp({ username, email, password });
        if (result && 'error' in result) { setError(result.error as string); }
        else if (result?.user) {
          setAuthenticatedUser({
            id: result.user._id,
            username: result.user.username,
            email: result.user.email,
            avatar: result.user.avatar,
            banner: result.user.banner,
            bio: result.user.bio,
            preferredLanguage: result.user.preferredLanguage,
            isPro: result.user.isPro,
            isVerified: result.user.isVerified,
            stats: result.user.stats,
            friends: result.user.friends as string[] | undefined,
          });
          onClose();
        }
      }
    } catch { setError('NEURAL LINK ERROR: UPLINK FAILED'); }
    finally { setLoading(false); }
  };

  const ValidationIcon = ({ valid, checking }: { valid: boolean | null; checking?: boolean }) => {
    if (checking) return <Loader2 size={12} className="animate-spin text-gray-600" />;
    if (valid === null) return null;
    return valid ? <Check size={12} className="text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> : <AlertCircle size={12} className="text-rose-500" />;
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className={`w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl glass-panel animate-in zoom-in-95 duration-300 border-white/10 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
        
        <div className="p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4 group">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
              <img src="/logo.png" alt="SyntaxArk" className="w-20 h-20 object-contain relative z-10 drop-shadow-2xl transition-transform group-hover:scale-110" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-[0.3em] text-white">
              {mode === 'login' ? 'Authentication' : 'Initialization'}
            </h1>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Synchronize Neural Interface</p>
          </div>

          {/* OAuth - High Contrast */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button 
              onClick={() => signIn("google")}
              className="h-11 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 hover:border-white/10 transition-all active:scale-95"
            >
              <GoogleIcon /> Google
            </button>
            <button 
              onClick={() => signIn("github")}
              className="h-11 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 hover:border-white/10 transition-all active:scale-95"
            >
              <GitHubIcon /> GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6 opacity-30">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Manual Protocol</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-1">Entity Identifier</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="text" placeholder="USERNAME" value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required minLength={3} maxLength={20}
                    className="ethereal-input w-full h-11 pl-10 pr-10 text-xs font-bold uppercase tracking-wider"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2"><ValidationIcon valid={usernameValid} checking={checkingUsername} /></div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-1">Comms Frequency</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={mode === 'login' ? 'text' : 'email'} placeholder={mode === 'login' ? 'EMAIL OR USERNAME' : 'EMAIL ADDRESS'} value={email}
                  onChange={(e) => setEmail(e.target.value)} required
                  className="ethereal-input w-full h-11 pl-10 pr-10 text-xs font-bold uppercase tracking-wider"
                />
                {mode === 'signup' && <div className="absolute right-3 top-1/2 -translate-y-1/2"><ValidationIcon valid={emailValid} checking={checkingEmail} /></div>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-1">Access Cipher</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  className="ethereal-input w-full h-11 pl-10 pr-12 text-xs font-bold"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {mode === 'signup' && <ValidationIcon valid={passwordValid} />}
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1 text-gray-600 hover:text-white transition-colors">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit" disabled={loading || (mode === 'signup' && (!usernameValid || !emailValid || !passwordValid))}
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_25px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-3 disabled:opacity-20 active:scale-95 mt-4"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : (mode === 'login' ? 'ESTABLISH LINK' : 'INITIALIZE NODE')}
            </button>
          </form>

          <button 
            onClick={() => { loginAsGuest(); onClose(); }}
            className="w-full h-11 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3 mt-3"
          >
            <Ghost size={14} /> Continue as Anonymous Ghost
          </button>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 hover:text-blue-400 transition-colors">
              {mode === 'login' ? "Initialize New Entity Protocol" : "Back to Authentication Protocol"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
