import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../store/useAuth';
import { useCommunity, type PostType } from '../../store/useCommunity';
import { useEditor } from '../../store/useEditor';
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { PublicUserProfileModal } from "../Profile/PublicUserProfileModal";
import {
  Hash, Mic, MicOff, Headphones, HeadphoneOff, Plus,
  MessageSquare, Heart, Share2, Globe, Trophy, Rocket, Users, X, Settings, Image as ImageIcon
} from 'lucide-react';
import Editor from '@monaco-editor/react';

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
    <div className="w-full max-w-md rounded-2xl glass-panel border border-white/10 p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white">{title}</h3>
        <button 
          onClick={onClose} 
          className="p-2 rounded-xl hover:bg-white/10 text-gray-500 hover:text-white transition-all group"
        >
          <X size={16} className="group-hover:rotate-90 transition-transform" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const CreatePostModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';
  const createPost = useMutation(api.community.createPost);
  const generateAttachmentUploadUrl = useMutation(api.chat.generateAttachmentUploadUrl);
  const enqueueAttachmentScan = useMutation(api.chat.enqueueAttachmentScan);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('discussion');
  const [tags] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Attachment state
  const [attachmentStorageId, setAttachmentStorageId] = useState<string | undefined>(undefined);
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFeedback({ msg: "Only image payloads are authorized.", type: 'error' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setFeedback({ msg: "Payload exceeds 8MB limit.", type: 'error' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const uploadUrl = await generateAttachmentUploadUrl();
      const xhr = new XMLHttpRequest();
      const json = await new Promise<any>((resolve, reject) => {
        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error("Uplink failed"));
        };
        xhr.onerror = () => reject(new Error("Network disruption"));
        xhr.send(file);
      });

      setAttachmentStorageId(json.storageId);
      setAttachmentLabel(file.name);
      await enqueueAttachmentScan({ storageId: json.storageId as any });
    } catch {
      setFeedback({ msg: "Synchronization failed. Try again.", type: 'error' });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

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
        language: 'javascript',
        attachmentStorageId: attachmentStorageId as any,
        attachmentType: attachmentStorageId ? 'image' : undefined,
      });
      onClose();
    } catch {
      setFeedback({ msg: "Failed to broadcast thread.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-lg p-4 animate-in fade-in">
      <div className="w-full max-w-xl rounded-3xl glass-panel border border-white/10 p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h2 className="text-lg font-black uppercase tracking-[0.3em] text-white flex items-center gap-3">
              <Plus className="text-blue-500" /> New Post
            </h2>
            {feedback && (
              <p className={`text-[9px] font-black uppercase tracking-widest ${feedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {feedback.msg === "Failed to broadcast thread." ? "Failed to create post" : feedback.msg}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-all"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['discussion', 'challenge', 'showcase', 'collab-invite'] as PostType[]).map(t => (
                <button 
                  key={t} 
                  type="button" 
                  onClick={() => setType(t)} 
                  className={`h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${type === t ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'}`}
                >
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Title</label>
            <input 
              required 
              className="ethereal-input w-full h-11 px-4 text-sm font-bold uppercase tracking-wider" 
              placeholder="ENTER A TITLE..." 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Content</label>
            <textarea 
              required 
              className="ethereal-input w-full p-4 text-sm min-h-[120px] resize-none leading-relaxed font-medium" 
              placeholder="DESCRIBE YOUR POST..." 
              value={content} 
              onChange={e => setContent(e.target.value)} 
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Image (Optional)</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            {attachmentStorageId ? (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 group">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <ImageIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 truncate">{attachmentLabel}</p>
                  <p className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">Image Attached</p>
                </div>
                <button type="button" onClick={() => { setAttachmentStorageId(undefined); setAttachmentLabel(''); }} className="p-2 text-gray-600 hover:text-rose-400 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-12 rounded-2xl bg-white/5 border border-dashed border-white/10 text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest"
              >
                <ImageIcon size={18} /> {uploading ? `Uploading... ${uploadProgress}%` : 'Attach Image'}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Code Snippet (Optional)</label>
            <div className="rounded-2xl overflow-hidden border border-white/5 bg-black/20 h-40">
              <Editor 
                height="100%" 
                language="javascript" 
                theme={isDark ? 'vs-dark' : 'light'} 
                value={code} 
                onChange={(val) => setCode(val || '')} 
                options={{ 
                  minimap: { enabled: false }, 
                  fontSize: 12, 
                  lineNumbers: 'off'
                }} 
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 h-12 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] text-gray-500 bg-white/5 hover:bg-white/10 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || uploading} 
              className="flex-1 h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_0_25px_rgba(37,99,235,0.3)] transition-all disabled:opacity-20 active:scale-95"
            >
              {loading ? 'Posting...' : 'Create Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
const PostItem: React.FC<{ post: any; onOpenProfile: (userId: string) => void }> = ({ post, onOpenProfile }) => {
  const { theme } = useEditor();
  const isDark = theme === 'vs-dark';
  const likePost = useMutation(api.community.likePost);
  const typeIcons: Record<string, React.ReactNode> = {
    challenge: <Trophy size={14} className="text-amber-400" />,
    showcase: <Rocket size={14} className="text-purple-400" />,
    'collab-invite': <Users size={14} className="text-emerald-400" />,
    discussion: <MessageSquare size={14} className="text-blue-400" />,
  };

  return (
    <div className="glass-card p-4 md:p-5 mb-4 group hover:border-white/10 transition-all duration-300">
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            type="button" 
            onClick={() => post.authorId && onOpenProfile(post.authorId)} 
            className="relative shrink-0 group/avatar"
          >
            <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
            <img 
              src={post.authorAvatar || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`} 
              alt={post.authorName} 
              className="w-10 h-10 rounded-xl border border-white/10 relative z-10 object-cover" 
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(post.authorName || 'user')}`; }}
            />
          </button>
          <div className="min-w-0">
            <h3 className="text-[13px] font-black text-white uppercase tracking-wider group-hover:text-blue-400 transition-colors">
              {post.title}
            </h3>
            <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1 flex-wrap">
              <button type="button" onClick={() => post.authorId && onOpenProfile(post.authorId)} className="hover:text-blue-400 transition-colors">
                {post.authorName}
              </button>
              <span>•</span>
              <span className="flex items-center gap-1 text-gray-400">
                {typeIcons[post.type] || <MessageSquare size={12} />} 
                {post.type.replace('-', ' ')}
              </span>
              <span>•</span>
              <span>{new Date(post.timestamp).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[11px] mb-4 leading-relaxed text-gray-400 font-medium px-1">
        {post.content}
      </div>

      {post.attachmentUrl && (
        <div className="mb-4 rounded-2xl overflow-hidden border border-white/5 bg-black/20 group/img relative">
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none" />
          <img src={post.attachmentUrl} alt="Post image" className="w-full h-auto max-h-[400px] object-contain mx-auto" />
        </div>
      )}

      {post.codeSnippet && (
        <div className="mb-4 rounded-xl overflow-hidden border border-white/5 bg-black/20">
          <div className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] border-b border-white/5 text-gray-500 flex justify-between items-center">
            <span>{post.language || 'source code'}</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30" />
            </div>
          </div>
          <Editor 
            height="160px" 
            language={post.language || 'javascript'} 
            value={post.codeSnippet} 
            theme={isDark ? 'vs-dark' : 'light'} 
            options={{ 
              readOnly: true, 
              minimap: { enabled: false }, 
              scrollBeyondLastLine: false, 
              fontSize: 11, 
              lineNumbers: 'off', 
              folding: false, 
              domReadOnly: true
            }} 
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-white/5 text-[10px] font-bold uppercase tracking-widest flex-wrap">
        <button 
          onClick={() => likePost({ postId: post._id })} 
          className={`flex items-center gap-2 transition-all hover:scale-110 ${post.likes > 0 ? 'text-rose-400' : 'text-gray-500 hover:text-rose-400'}`}
        >
          <Heart size={14} className={post.likes > 0 ? 'fill-rose-400 text-rose-400' : ''} />
          {post.likes}
        </button>
        <button className="flex items-center gap-2 text-gray-500 hover:text-blue-400 transition-all hover:scale-110">
          <MessageSquare size={14} />
          {post.comments?.length || 0}
        </button>
        <button className="flex items-center gap-2 ml-auto text-gray-500 hover:text-emerald-400 transition-all">
          <Share2 size={14} />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
};

const MessageComposer: React.FC<{
  disabled?: boolean;
  getUploadUrl: () => Promise<string>;
  enqueueScan: (storageId: string) => Promise<any>;
  onSend: (payload: { content: string; attachmentStorageId?: string; attachmentType?: "image" | "voice" }) => Promise<void>;
}> = ({ disabled, getUploadUrl, enqueueScan, onSend }) => {
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VOICE_BYTES = 12 * 1024 * 1024;
  const BLOCKED_TERMS = ["child sexual abuse", "terrorist instruction", "kill yourself"];
  const [content, setContent] = useState('');
  const [attachmentStorageId, setAttachmentStorageId] = useState<string | undefined>(undefined);
  const [attachmentType, setAttachmentType] = useState<"image" | "voice" | undefined>(undefined);
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const uploadBlob = async (blob: Blob, type: "image" | "voice", label: string) => {
    setUploading(true);
    setUploadProgress(0);
    const uploadUrl = await getUploadUrl();
    const json = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);
      xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Invalid upload response"));
          }
        } else {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(blob);
    });
    setAttachmentStorageId(json.storageId);
    setAttachmentType(type);
    setAttachmentLabel(label);
    await enqueueScan(json.storageId);
    setUploading(false);
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFeedback({ msg: "Authorized image payloads only.", type: 'error' });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFeedback({ msg: "Payload exceeds 8MB capacity.", type: 'error' });
      e.target.value = "";
      return;
    }
    try {
      await uploadBlob(file, "image", file.name);
    } catch {
      setFeedback({ msg: "Neural link upload failed.", type: 'error' });
      setUploading(false);
      setUploadProgress(0);
    } finally {
      e.target.value = "";
    }
  };

  const toggleVoiceRecording = async () => {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          if (blob.size > MAX_VOICE_BYTES) {
            setFeedback({ msg: "Vox log exceeds 12MB capacity.", type: 'error' });
            stream.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
            mediaRecorderRef.current = null;
            setRecording(false);
            return;
          }
          try {
            await uploadBlob(blob, "voice", `voice-${Date.now()}.webm`);
          } catch {
            setFeedback({ msg: "Vox transmission failed.", type: 'error' });
            setUploading(false);
            setUploadProgress(0);
          }
          stream.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          setRecording(false);
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
        setRecording(true);
      } catch {
        setFeedback({ msg: "Audio hardware access denied.", type: 'error' });
      }
      return;
    }

    mediaRecorderRef.current?.stop();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    const lowered = text.toLowerCase();
    if (BLOCKED_TERMS.some((term) => lowered.includes(term))) {
      setFeedback({ msg: "Intelligence failed moderation filters.", type: 'error' });
      return;
    }
    if (!text && !attachmentStorageId) return;
    if (uploading) return;
    try {
      await onSend({
        content: text || "(attachment)",
        attachmentStorageId,
        attachmentType,
      });
    } catch (err: any) {
      setFeedback({ msg: err?.message || "Transmission synchronization error.", type: 'error' });
      return;
    }
    setContent('');
    setAttachmentStorageId(undefined);
    setAttachmentType(undefined);
    setAttachmentLabel('');
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {(attachmentStorageId || uploading || feedback) && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border animate-in fade-in slide-in-from-bottom-1 ${
          feedback?.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse ${
            feedback?.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
          }`} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {feedback ? feedback.msg : (uploading ? `Uploading Payload... ${uploadProgress}%` : `Attached ${attachmentType}: ${attachmentLabel}`)}
          </span>
          {(attachmentStorageId && !uploading) && (
            <button type="button" onClick={() => { setAttachmentStorageId(undefined); setAttachmentType(undefined); setAttachmentLabel(''); }} className="ml-auto text-rose-400 hover:text-rose-300">
              <X size={12} />
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="flex-1 relative group">
          <input 
            disabled={disabled} 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            placeholder="SYNCHRONIZE MESSAGE..." 
            className="ethereal-input w-full h-10 px-4 text-xs font-bold uppercase tracking-wider" 
          />
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <div className="flex gap-1.5 shrink-0">
          <button 
            type="button" 
            disabled={uploading} 
            onClick={handlePickImage} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-gray-500 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20" 
            title="Attach image"
          >
            <ImageIcon size={16} />
          </button>
          <button 
            type="button" 
            disabled={uploading} 
            onClick={() => { void toggleVoiceRecording(); }} 
            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all disabled:opacity-20 ${recording ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`} 
            title="Record voice note"
          >
            {recording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button 
            type="submit" 
            disabled={disabled || uploading || (!content.trim() && !attachmentStorageId)} 
            className="px-5 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all disabled:opacity-20"
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
};

const HubChatPanel: React.FC<{ onOpenProfile: (userId: string) => void }> = ({ onOpenProfile }) => {
  const ensureDefaultServer = useMutation(api.chat.ensureDefaultServer);
  const servers = useQuery(api.chat.getServers) || [];
  const globalServer = servers.find((s: any) => s.inviteCode === 'syntax-global') || servers[0] || null;
  const channels = useQuery(api.chat.getChannels, globalServer ? { serverId: globalServer._id } : "skip") || [];
  const general = channels.find((c: any) => c.name.toLowerCase().includes('general')) || channels[0] || null;
  const messages = useQuery(api.chat.getMessages, general ? { channelId: general._id } : "skip") || [];
  const sendMessage = useMutation(api.chat.sendMessage);
  const generateAttachmentUploadUrl = useMutation(api.chat.generateAttachmentUploadUrl);
  const enqueueAttachmentScan = useMutation(api.chat.enqueueAttachmentScan);

  React.useEffect(() => {
    if (!globalServer) {
      void ensureDefaultServer({});
    }
  }, [globalServer, ensureDefaultServer]);

  return (
    <div className="h-full flex flex-col bg-[#141417]/50 backdrop-blur-xl text-gray-300">
      <div className="h-12 px-3 md:px-6 flex items-center border-b border-white/5 bg-white/5 shrink-0">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] mr-3 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Live Hub Intelligence</span>
      </div>
      <div className="flex-1 p-3 md:p-6 overflow-y-auto space-y-4 custom-scrollbar">
        {[...messages].reverse().map((m: any) => (
          <div key={m._id} className="group space-y-1">
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => m.authorId && onOpenProfile(m.authorId)} 
                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
              >
                {m.authorName}
              </button>
              <div className="h-px flex-1 bg-white/[0.02]" />
              <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter opacity-0 group-hover:opacity-100">
                {new Date(m._creationTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed pl-1">{m.content}</p>
            {m.attachmentUrl && (
              <div className="mt-2 pl-1">
                {m.attachmentType === 'image' && (
                  <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="inline-block rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/30 transition-all">
                    <img src={m.attachmentUrl} alt="Payload" className="max-w-[min(100%,200px)] max-h-40 object-cover" />
                  </a>
                )}
                {m.attachmentType === 'voice' && (
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-500/20 transition-all">
                    <Mic size={12} /> Play Voice Note
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-20 select-none space-y-4">
            <MessageSquare size={48} strokeWidth={1} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Standby for synchronization</span>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-white/5 bg-white/5 shrink-0">
        <MessageComposer
          disabled={!general}
          getUploadUrl={generateAttachmentUploadUrl}
          enqueueScan={(storageId) => enqueueAttachmentScan({ storageId: storageId as any })}
          onSend={async (payload) => {
            if (!general) return;
            await sendMessage({ channelId: general._id, ...payload, attachmentStorageId: payload.attachmentStorageId as any });
          }}
        />
      </div>
    </div>
  );
};

const ServersWorkspace: React.FC<{
  onOpenProfile: (userId: string) => void;
  requestedDmThreadId: string | null;
  onRequestedDmThreadConsumed: () => void;
}> = ({ onOpenProfile, requestedDmThreadId, onRequestedDmThreadConsumed }) => {
  const { user } = useAuth();
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<"text" | "voice" | "announcement">("text");
  const [serverNameEdit, setServerNameEdit] = useState('');
  const [serverIconEdit, setServerIconEdit] = useState('');

  const ensureDefaultServer = useMutation(api.chat.ensureDefaultServer);
  const createServer = useMutation(api.chat.createServer);
  const joinServerByInvite = useMutation(api.chat.joinServerByInvite);
  const createChannel = useMutation(api.chat.createChannel);
  const updateServerSettings = useMutation(api.chat.updateServerSettings);
  const sendMessage = useMutation(api.chat.sendMessage);
  const joinVoiceChannel = useMutation(api.chat.joinVoiceChannel);
  const leaveVoiceChannel = useMutation(api.chat.leaveVoiceChannel);
  const updateVoiceState = useMutation(api.chat.updateVoiceState);
  const sendVoiceSignal = useMutation(api.chat.sendVoiceSignal);
  const ackVoiceSignals = useMutation(api.chat.ackVoiceSignals);
  const generateAttachmentUploadUrl = useMutation(api.chat.generateAttachmentUploadUrl);
  const enqueueAttachmentScan = useMutation(api.chat.enqueueAttachmentScan);
  const startDmThread = useMutation(api.chat.startDmThread);
  const sendDmMessage = useMutation(api.chat.sendDmMessage);

  const servers = useQuery(api.chat.getServers) || [];
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const activeServer = servers.find((s: any) => s._id === activeServerId) || null;
  const channels = useQuery(api.chat.getChannels, activeServer ? { serverId: activeServer._id } : "skip") || [];
  const members = useQuery(api.chat.getServerMembers, activeServer ? { serverId: activeServer._id } : "skip") || [];
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const activeChannel = channels.find((c: any) => c._id === activeChannelId) || null;
  const channelMessages = useQuery(api.chat.getMessages, activeChannel ? { channelId: activeChannel._id } : "skip") || [];
  const voicePresence = useQuery(api.chat.listVoicePresence, activeChannel && activeChannel.type === "voice" ? { channelId: activeChannel._id } : "skip") || [];
  const pendingVoiceSignals = useQuery(api.chat.listPendingVoiceSignals, activeChannel && activeChannel.type === "voice" ? { channelId: activeChannel._id } : "skip") || [];
  const [vcJoined, setVcJoined] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const iceServers = useMemo(() => {
    const stun: RTCIceServer = { urls: "stun:stun.l.google.com:19302" };
    const turnUrls = (import.meta.env.VITE_TURN_URLS as string | undefined) || (import.meta.env.VITE_TURN_URL as string | undefined);
    const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
    if (!turnUrls) return [stun];
    const urls = turnUrls.split(",").map((s) => s.trim()).filter(Boolean);
    const turn: RTCIceServer = turnUser && turnCredential
      ? { urls, username: turnUser, credential: turnCredential }
      : { urls };
    return [stun, turn];
  }, []);

  const dmThreads = useQuery(api.chat.listDmThreads) || [];
  const [activeDmThreadId, setActiveDmThreadId] = useState<string | null>(null);
  const dmMessages = useQuery(api.chat.getDmMessages, activeDmThreadId ? { threadId: activeDmThreadId as any } : "skip") || [];

  React.useEffect(() => {
    if (servers.length === 0) {
      void ensureDefaultServer({});
      return;
    }
    const firstServer = servers[0];
    if (!activeServerId && firstServer) setActiveServerId(firstServer._id as unknown as string);
  }, [servers, activeServerId, ensureDefaultServer]);

  React.useEffect(() => {
    if (!activeChannelId && channels.length > 0) setActiveChannelId(channels[0]._id as unknown as string);
  }, [channels, activeChannelId]);

  React.useEffect(() => {
    if (!requestedDmThreadId) return;
    setActiveDmThreadId(requestedDmThreadId);
    setActiveChannelId(null);
    onRequestedDmThreadConsumed();
  }, [requestedDmThreadId, onRequestedDmThreadConsumed]);

  const closeVoice = async () => {
    for (const pc of peersRef.current.values()) pc.close();
    peersRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setRemoteStreams({});
    setVcJoined(false);
    await leaveVoiceChannel({});
  };

  const getOrCreatePeer = (remoteUserId: string, channelId: string) => {
    const existing = peersRef.current.get(remoteUserId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    }
    pc.onicecandidate = (ev) => {
      if (ev.candidate && user) {
        void sendVoiceSignal({
          channelId: channelId as any,
          toUserId: remoteUserId as any,
          kind: "ice",
          payload: JSON.stringify(ev.candidate.toJSON()),
        });
      }
    };
    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      if (!stream) return;
      setRemoteStreams((prev) => ({ ...prev, [remoteUserId]: stream }));
    };
    peersRef.current.set(remoteUserId, pc);
    return pc;
  };

  useEffect(() => {
    if (!vcJoined || !activeChannel || activeChannel.type !== "voice" || !user) return;
    const channelId = activeChannel._id as unknown as string;
    const selfId = user.id;

    const remoteUserIds = voicePresence
      .map((p: any) => String(p.userId))
      .filter((id: string) => id !== selfId);

    const existingPeers = Array.from(peersRef.current.keys());
    for (const peerId of existingPeers) {
      if (!remoteUserIds.includes(peerId)) {
        peersRef.current.get(peerId)?.close();
        peersRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    }

    for (const remoteId of remoteUserIds) {
      const pc = getOrCreatePeer(remoteId, channelId);
      if (selfId < remoteId && pc.signalingState === "stable") {
        void (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendVoiceSignal({
            channelId: channelId as any,
            toUserId: remoteId as any,
            kind: "offer",
            payload: JSON.stringify(offer),
          });
        })();
      }
    }
  }, [vcJoined, activeChannel, voicePresence, user, sendVoiceSignal, iceServers]);

  useEffect(() => {
    if (!vcJoined || !activeChannel || activeChannel.type !== "voice" || !user) return;
    const channelId = activeChannel._id;
    const run = async () => {
      const fresh = (pendingVoiceSignals as any[]).filter((s) => !processedSignalIdsRef.current.has(String(s._id)));
      if (fresh.length === 0) return;
      for (const sig of fresh) {
        processedSignalIdsRef.current.add(String(sig._id));
        const fromUserId = String(sig.fromUserId);
        const pc = getOrCreatePeer(fromUserId, String(channelId));
        if (sig.kind === "offer") {
          const offer = JSON.parse(sig.payload);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendVoiceSignal({
            channelId,
            toUserId: sig.fromUserId,
            kind: "answer",
            payload: JSON.stringify(answer),
          });
        } else if (sig.kind === "answer") {
          const answer = JSON.parse(sig.payload);
          if (pc.signalingState !== "closed") {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } else if (sig.kind === "ice") {
          const ice = JSON.parse(sig.payload);
          if (pc.signalingState !== "closed") {
            await pc.addIceCandidate(new RTCIceCandidate(ice));
          }
        }
      }
      await ackVoiceSignals({ ids: fresh.map((s) => s._id) });
    };
    void run();
  }, [vcJoined, activeChannel, pendingVoiceSignals, ackVoiceSignals, sendVoiceSignal, user]);

  return (
    <div className="h-full flex backdrop-blur-xl bg-[#141417]/80 text-gray-300 overflow-x-auto">
      <div className="w-16 sm:w-[72px] min-w-16 sm:min-w-[72px] bg-black/40 border-r border-white/5 p-2 sm:p-3 space-y-3 overflow-y-auto no-scrollbar shrink-0">
        {servers.map((s: any) => (
          <button 
            key={s._id} 
            onClick={() => { setActiveServerId(s._id); setActiveChannelId(null); }} 
            className={`w-12 h-12 rounded-2xl overflow-hidden border transition-all ${s._id === activeServerId ? 'border-blue-500 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'border-white/10 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'}`}
          >
            <img src={s.icon} className="w-full h-full object-cover" alt={s.name} />
          </button>
        ))}
        <button onClick={() => setShowCreateServer(true)} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all"><Plus size={24} /></button>
        <button onClick={() => setShowJoinServer(true)} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-[10px] font-black uppercase tracking-tighter text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all">Join</button>
      </div>

      <div className="w-56 sm:w-64 min-w-56 sm:min-w-64 bg-white/[0.02] border-r border-white/5 flex flex-col shrink-0">
        <div className="h-14 px-3 sm:px-4 flex items-center justify-between border-b border-white/5 bg-white/5 shrink-0 gap-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-white truncate">{activeServer?.name || 'SYNC NODE'}</span>
          <button 
            className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-all"
            onClick={() => {
              if (activeServer) {
                setServerNameEdit(activeServer.name);
                setServerIconEdit(activeServer.icon);
                setShowServerSettings(true);
              }
            }}
          >
            <Settings size={14} />
          </button>
        </div>
        <div className="flex-1 p-2.5 sm:p-3 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-1">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 px-2 mb-2">Synchronized Channels</div>
            {channels.map((c: any) => (
              <button 
                key={c._id} 
                onClick={() => { setActiveChannelId(c._id); setActiveDmThreadId(null); }} 
                className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${c._id === activeChannelId ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'}`}
              >
                {c.type === "voice" ? <Mic size={14} className="opacity-60" /> : <Hash size={14} className="opacity-60" />}
                {c.name}
              </button>
            ))}
            <button onClick={() => setShowCreateChannel(true)} className="w-full text-left px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white transition-all border border-dashed border-white/10">+ New Segment</button>
          </div>

          <div className="space-y-1">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 px-2 mb-2">Direct Links</div>
            {dmThreads.map((t: any) => (
              <div key={t._id} className="flex items-center gap-1 group">
                <button 
                  onClick={() => { setActiveDmThreadId(t._id); setActiveChannelId(null); }} 
                  className={`flex-1 text-left px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all truncate ${t._id === activeDmThreadId ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'}`}
                >
                  {t.otherUser?.username || 'Unknown link'}
                </button>
                {t.otherUser?._id && (
                  <button onClick={() => onOpenProfile(t.otherUser._id)} className="p-2 rounded-xl text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100">
                    <Users size={12} />
                  </button>
                )}
              </div>
            ))}
            {members.map((m: any) => (
              m.user && <div key={m._id} className="flex items-center gap-1 group">
                <button 
                  onClick={() => { void startDmThread({ otherUserId: m.user._id }).then((id) => setActiveDmThreadId(id as unknown as string)); setActiveChannelId(null); }} 
                  className="flex-1 text-left px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-all"
                >
                  Link {m.user.username}
                </button>
                <button onClick={() => onOpenProfile(m.user._id)} className="p-2 rounded-xl text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100">
                  <Users size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[300px] flex flex-col bg-black/20">
        <div className="h-14 px-3 sm:px-6 flex items-center justify-between border-b border-white/5 bg-white/5 shrink-0 gap-2">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${activeDmThreadId ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`} />
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] text-white truncate">
              {activeDmThreadId ? 'Encrypted Direct Link' : `# ${activeChannel?.name || 'Synchronizing...'}`}
            </span>
          </div>
          {activeChannel?.type === "voice" && (
            <div className="flex gap-1.5 sm:gap-2 shrink-0">
              <button 
                onClick={() => { void (async () => {
                  if (!vcJoined) {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    localStreamRef.current = stream;
                    await joinVoiceChannel({ channelId: activeChannel._id, muted: micMuted, deafened });
                    setVcJoined(true);
                  } else {
                    await closeVoice();
                  }
                })(); }} 
                className={`h-8 px-4 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border ${vcJoined ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}
              >
                {vcJoined ? 'Exit Comms' : 'Sync Voice'}
              </button>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => { void (async () => {
                    const next = !micMuted;
                    setMicMuted(next);
                    if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !next; });
                    await updateVoiceState({ muted: next, deafened });
                  })(); }} 
                  className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${micMuted ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10 hover:text-white'}`}
                  disabled={!vcJoined}
                >
                  {micMuted ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <button 
                  onClick={() => { void (async () => {
                    const next = !deafened;
                    setDeafened(next);
                    await updateVoiceState({ muted: micMuted, deafened: next });
                  })(); }} 
                  className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${deafened ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10 hover:text-white'}`}
                  disabled={!vcJoined}
                >
                  {deafened ? <HeadphoneOff size={14} /> : <Headphones size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 custom-scrollbar">
          {(activeDmThreadId ? dmMessages : channelMessages).slice().reverse().map((m: any) => (
            <div key={m._id} className="group space-y-1">
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => m.authorId && onOpenProfile(m.authorId)} 
                  className={`text-[10px] font-black uppercase tracking-widest hover:underline transition-colors ${m.senderId === user?.id ? 'text-purple-400' : 'text-blue-400'}`}
                >
                  {m.senderName || m.authorName}
                </button>
                <div className="h-px flex-1 bg-white/[0.02]" />
                <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                  {new Date(m._creationTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed pl-1">{m.content}</p>
              {m.attachmentUrl && (
                <div className="mt-2 pl-1">
                  {m.attachmentType === 'image' && (
                    <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="inline-block rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/30 transition-all">
                      <img src={m.attachmentUrl} alt="Payload" className="max-w-[min(100%,300px)] max-h-60 object-cover shadow-2xl" />
                    </a>
                  )}
                  {m.attachmentType === 'voice' && (
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-500/20 transition-all shadow-lg">
                      <Mic size={14} /> PLAY VOX LOG
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {activeChannel?.type === "voice" && (
            <div className="mt-8 glass-card p-5 space-y-4">
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-3 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                Audio Spectrum Presence
              </div>
              {voicePresence.length === 0 && <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest py-2">No audio synchronization active.</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {voicePresence.map((p: any) => (
                  <div key={p._id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">{p.username}</span>
                    <div className="flex items-center gap-2 opacity-40">
                      {p.muted ? <MicOff size={12} className="text-rose-400" /> : <Mic size={12} className="text-emerald-400" />}
                      {p.deafened ? <HeadphoneOff size={12} className="text-rose-400" /> : <Headphones size={12} className="text-gray-400" />}
                    </div>
                  </div>
                ))}
              </div>
              {Object.entries(remoteStreams).map(([uid, stream]) => (
                <audio key={uid} autoPlay playsInline ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }} />
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-white/5 bg-white/5 shrink-0">
          <MessageComposer
            disabled={!activeChannel && !activeDmThreadId}
            getUploadUrl={generateAttachmentUploadUrl}
            enqueueScan={(storageId) => enqueueAttachmentScan({ storageId: storageId as any })}
            onSend={async (payload) => {
              if (activeDmThreadId) {
                await sendDmMessage({ threadId: activeDmThreadId as any, ...payload, attachmentStorageId: payload.attachmentStorageId as any });
              } else if (activeChannel) {
                await sendMessage({ channelId: activeChannel._id, ...payload, attachmentStorageId: payload.attachmentStorageId as any });
              }
            }}
          />
        </div>
      </div>

      {showCreateServer && (
        <Modal title="Initialize New Node" onClose={() => setShowCreateServer(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1">Node Identifier</label>
              <input value={newServerName} onChange={(e) => setNewServerName(e.target.value)} placeholder="NAME..." className="ethereal-input w-full h-10 px-4 text-xs font-bold uppercase tracking-widest" />
            </div>
            <button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 transition-all" onClick={async () => {
              const name = newServerName.trim();
              if (!name) return;
              const id = await createServer({ name });
              setActiveServerId(id as unknown as string);
              setShowCreateServer(false);
              setNewServerName('');
            }}>Initialize</button>
          </div>
        </Modal>
      )}

      {showJoinServer && (
        <Modal title="Connect to Remote Node" onClose={() => setShowJoinServer(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1">Encrypted Invite Code</label>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="CODE..." className="ethereal-input w-full h-10 px-4 text-xs font-bold uppercase tracking-widest" />
            </div>
            <button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 transition-all" onClick={async () => {
              const id = await joinServerByInvite({ inviteCode: joinCode.trim() });
              if (!id) { alert("Invalid access code"); return; }
              setActiveServerId(id as unknown as string);
              setShowJoinServer(false);
              setJoinCode('');
            }}>Link Node</button>
          </div>
        </Modal>
      )}

      {showCreateChannel && activeServer && (
        <Modal title="New Segment Definition" onClose={() => setShowCreateChannel(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1">Segment Name</label>
              <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="NAME..." className="ethereal-input w-full h-10 px-4 text-xs font-bold uppercase tracking-widest" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1">Protocol Type</label>
              <select value={newChannelType} onChange={(e) => setNewChannelType(e.target.value as any)} className="ethereal-input w-full h-10 px-4 text-xs font-bold uppercase tracking-widest bg-[#1a1a1e]">
                <option value="text">TEXT PROTOCOL</option>
                <option value="voice">AUDIO SPECTRUM</option>
                <option value="announcement">BROADCAST ONLY</option>
              </select>
            </div>
            <button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 transition-all" onClick={async () => {
              const name = newChannelName.trim();
              if (!name) return;
              await createChannel({ serverId: activeServer._id, name, type: newChannelType });
              setShowCreateChannel(false);
              setNewChannelName('');
            }}>Define Segment</button>
          </div>
        </Modal>
      )}

      {showServerSettings && activeServer && (
        <Modal title="Node Configuration" onClose={() => setShowServerSettings(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1">Node Name</label>
              <input value={serverNameEdit} onChange={(e) => setServerNameEdit(e.target.value)} placeholder="NAME..." className="ethereal-input w-full h-10 px-4 text-xs font-bold uppercase tracking-widest" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-1">Visual Identifier URL</label>
              <input value={serverIconEdit} onChange={(e) => setServerIconEdit(e.target.value)} placeholder="ICON URL..." className="ethereal-input w-full h-10 px-4 text-xs font-bold uppercase tracking-widest" />
            </div>
            <button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 transition-all" onClick={async () => {
              await updateServerSettings({ serverId: activeServer._id, name: serverNameEdit.trim() || undefined, icon: serverIconEdit.trim() || undefined });
              setShowServerSettings(false);
            }}>Apply Config</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export const CommunityPanel: React.FC = () => {
  const { theme } = useEditor();
  const { setShowCreatePost } = useCommunity();
  const { user, logout, setShowAuth, setShowProfile } = useAuth();
  const { signOut } = useAuthActions();
  const apiAny = api as any;
  const addFriend = useMutation(apiAny.users.addFriend);
  const removeFriend = useMutation(apiAny.users.removeFriend);
  const startDmThread = useMutation(apiAny.chat.startDmThread);
  const posts = useQuery(api.community.getPosts) || [];
  const isDark = theme === 'vs-dark';
  const isLoggedIn = Boolean(user && !user.isGuest);
  const [view, setView] = useState<'feed' | 'hub' | 'servers'>('feed');
  const [filter, setFilter] = useState<PostType | 'all'>('all');
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [requestedDmThreadId, setRequestedDmThreadId] = useState<string | null>(null);
  const selectedProfile = useQuery(
    apiAny.users.getPublicProfile,
    selectedProfileUserId ? { userId: selectedProfileUserId as any } : "skip",
  );
  const filteredPosts = useMemo(() => (filter === 'all' ? posts : posts.filter(p => p.type === filter)), [filter, posts]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ threadId?: string }>;
      const threadId = custom.detail?.threadId;
      if (!threadId) return;
      setRequestedDmThreadId(threadId);
      setView('servers');
    };
    window.addEventListener('syntaxark:open-dm', handler as EventListener);
    return () => window.removeEventListener('syntaxark:open-dm', handler as EventListener);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // fall back to local logout
    } finally {
      logout();
    }
  };

  const openUserProfile = (targetUserId: string) => {
    if (!targetUserId) return;
    if (user && targetUserId === user.id) {
      setShowProfile(true);
      return;
    }
    setSelectedProfileUserId(targetUserId);
  };

  const closePublicProfile = () => {
    setSelectedProfileUserId(null);
  };

  const handleAddFriend = async () => {
    if (!selectedProfileUserId) return;
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    await addFriend({ friendId: selectedProfileUserId as any });
  };

  const handleRemoveFriend = async () => {
    if (!selectedProfileUserId) return;
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    await removeFriend({ friendId: selectedProfileUserId as any });
  };

  const handleSendMessage = async () => {
    if (!selectedProfileUserId) return;
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    const threadId = await startDmThread({ otherUserId: selectedProfileUserId as any });
    setRequestedDmThreadId(threadId as string);
    setSelectedProfileUserId(null);
    setView('servers');
  };

  const profileModal = selectedProfileUserId ? (
    <PublicUserProfileModal
      profile={selectedProfile as any}
      onClose={closePublicProfile}
      onAddFriend={handleAddFriend}
      onRemoveFriend={handleRemoveFriend}
      onSendMessage={handleSendMessage}
      onOpenOwnProfile={() => {
        setSelectedProfileUserId(null);
        setShowProfile(true);
      }}
      isLoggedIn={isLoggedIn}
    />
  ) : null;

  if (view === 'hub') {
    return (
      <>
        <div className="h-full flex flex-col backdrop-blur-xl bg-[#141417]/80">
          <div className="h-14 bg-white/5 border-b border-white/5 flex items-center justify-between px-3 sm:px-6 shrink-0 gap-2">
            <button 
              onClick={() => setView('feed')} 
              className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors flex items-center gap-2 group"
            >
              <X size={14} className="group-hover:rotate-90 transition-transform" /> Back to Feed
            </button>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white text-center flex-1">Community Hub</span>
            <div className="w-10 sm:w-20 shrink-0" />
          </div>
          <div className="flex-1 overflow-hidden"><HubChatPanel onOpenProfile={openUserProfile} /></div>
        </div>
        {profileModal}
      </>
    );
  }

  if (view === 'servers') {
    return (
      <>
        <div className="h-full flex flex-col backdrop-blur-xl bg-[#141417]/80">
          <div className="h-14 bg-white/5 border-b border-white/5 flex items-center justify-between px-3 sm:px-6 shrink-0 gap-2">
            <button 
              onClick={() => setView('feed')} 
              className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors flex items-center gap-2 group"
            >
              <X size={14} className="group-hover:rotate-90 transition-transform" /> Back to Feed
            </button>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white text-center flex-1">Servers Workspace</span>
            <div className="w-10 sm:w-20 shrink-0" />
          </div>
          <div className="flex-1 overflow-hidden">
            {!isLoggedIn ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="p-6 rounded-full bg-blue-500/5 border border-blue-500/10">
                  <Users size={48} className="text-blue-500/40" />
                </div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-widest mb-2">Authenticated Access Required</h3>
                  <p className="text-xs text-gray-500 max-w-xs font-medium leading-relaxed uppercase tracking-wider">Sign in to unlock servers, direct messages, voice channels, and media messaging.</p>
                </div>
                <button 
                  onClick={() => setShowAuth(true)} 
                  className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <ServersWorkspace onOpenProfile={openUserProfile} requestedDmThreadId={requestedDmThreadId} onRequestedDmThreadConsumed={() => setRequestedDmThreadId(null)} />
            )}
          </div>
        </div>
        {profileModal}
      </>
    );
  }

  return (
    <div className={`h-full flex flex-col backdrop-blur-xl ${isDark ? 'bg-[#141417]/80 text-gray-400' : 'bg-white text-gray-800'}`}>
      <div className="p-3 sm:p-6 border-b border-white/5 bg-white/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white">Community</h2>
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Explore and connect</p>
        </div>
        {isLoggedIn && user ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setShowProfile(true)} className="p-0.5 rounded-xl border border-blue-500/30 hover:scale-110 transition-all">
              <img src={user.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" title="Profile Settings" />
            </button>
            <button 
              onClick={() => { void handleLogout(); }} 
              className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
            >
              Log Out
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowAuth(true)} 
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all"
          >
            Sign In
          </button>
        )}
      </div>

      <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setView('hub')} 
            className="flex-1 h-9 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 transition-all"
          >
            <Globe size={14} /> Hub Chat
          </button>
          <button 
            onClick={() => setView('servers')} 
            className="flex-1 h-9 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 transition-all"
          >
            <Users size={14} /> Servers
          </button>
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button 
            onClick={() => setFilter('all')} 
            className={`whitespace-nowrap h-7 px-4 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${filter === 'all' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'border-white/10 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
          >
            All Posts
          </button>
          {['challenge', 'showcase', 'collab-invite', 'discussion'].map((t: any) => (
            <button 
              key={t} 
              onClick={() => setFilter(t)} 
              className={`whitespace-nowrap h-7 px-4 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all capitalize ${filter === t ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'border-white/10 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
            >
              {t.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 relative custom-scrollbar">
        {filteredPosts.length > 0 ? (
          <div className="max-w-3xl mx-auto">
            {filteredPosts.map((p: any) => <PostItem key={p._id} post={p} onOpenProfile={openUserProfile} />)}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-20 select-none space-y-4">
            <MessageSquare size={64} strokeWidth={1} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">No posts found</span>
          </div>
        )}
        
        <button 
          onClick={() => isLoggedIn ? setShowCreatePost(true) : setShowAuth(true)} 
          className="fixed bottom-5 right-4 sm:bottom-8 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-[0_8px_30px_rgba(37,99,235,0.4)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 border border-blue-400/30"
        >
          <Plus size={24} />
        </button>
      </div>
      {profileModal}
    </div>
  );
};

