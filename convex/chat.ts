import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const MAX_MESSAGE_LENGTH = 4000;
const BLOCKED_TERMS = ["child sexual abuse", "terrorist instruction", "kill yourself"];

const ensureAuthedUser = async (ctx: any) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");
  return userId;
};

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

const validateMessagePayload = (content: string, attachmentType?: "image" | "voice") => {
  const normalized = content.trim();
  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long (max ${MAX_MESSAGE_LENGTH} chars)`);
  }
  const lowered = normalized.toLowerCase();
  if (BLOCKED_TERMS.some((term) => lowered.includes(term))) {
    throw new Error("Message failed moderation");
  }
  if (attachmentType && !["image", "voice"].includes(attachmentType)) {
    throw new Error("Invalid attachment type");
  }
};

const enforceRateLimit = async (
  ctx: any,
  key: string,
  maxPerWindow: number,
  windowMs: number,
) => {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key_window", (q: any) => q.eq("key", key).eq("windowStart", windowStart))
    .first();
  if (!existing) {
    await ctx.db.insert("rateLimits", {
      key,
      windowStart,
      count: 1,
      updatedAt: now,
    });
    return;
  }
  if (existing.count >= maxPerWindow) {
    throw new Error("Rate limit exceeded. Please slow down.");
  }
  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
    updatedAt: now,
  });
};

const validateAttachmentStorage = async (
  ctx: any,
  storageId: Id<"_storage">,
  attachmentType?: "image" | "voice",
) => {
  const meta = await ctx.storage.getMetadata(storageId);
  if (!meta) throw new Error("Attachment not found");
  const bytes = Number(meta.size ?? 0);
  const contentType = String(meta.contentType || "").toLowerCase();

  if (attachmentType === "image") {
    if (!contentType.startsWith("image/")) throw new Error("Attachment content type mismatch");
    if (bytes > 8 * 1024 * 1024) throw new Error("Image too large (max 8MB)");
  } else if (attachmentType === "voice") {
    const allowedVoice = contentType.startsWith("audio/") || contentType.includes("video/webm") || contentType.includes("ogg");
    if (!allowedVoice) throw new Error("Voice attachment content type mismatch");
    if (bytes > 12 * 1024 * 1024) throw new Error("Voice note too large (max 12MB)");
  }

  const strict = (globalThis as any).process?.env?.ATTACHMENT_STRICT_MODE === "true";
  if (strict && !contentType) {
    throw new Error("Attachment blocked by security policy");
  }

  const scanRequired = (globalThis as any).process?.env?.ATTACHMENT_SCAN_REQUIRED === "true";
  if (scanRequired) {
    const scan = await ctx.db
      .query("attachmentScans")
      .withIndex("by_storage_id", (q: any) => q.eq("storageId", storageId))
      .first();
    if (!scan || scan.status === "pending") {
      throw new Error("Attachment scan pending");
    }
    if (scan.status === "blocked") {
      throw new Error(scan.reason || "Attachment blocked by scanner");
    }
  }
};

const isServerMember = async (ctx: any, serverId: Id<"servers">, userId: Id<"users">) => {
  const member = await ctx.db
    .query("serverMembers")
    .withIndex("by_server", (q: any) => q.eq("serverId", serverId))
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .first();
  return Boolean(member);
};

export const ensureDefaultServer = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureAuthedUser(ctx);
    let global = await ctx.db
      .query("servers")
      .withIndex("by_invite", (q) => q.eq("inviteCode", "syntax-global"))
      .first();

    if (!global) {
      const serverId = await ctx.db.insert("servers", {
        name: "SyntaxArk Global",
        icon: "https://api.dicebear.com/7.x/initials/svg?seed=SA&backgroundColor=3b82f6",
        ownerId: userId,
        inviteCode: "syntax-global",
      });
      await ctx.db.insert("channels", { serverId, name: "general", type: "text", topic: "General chat" });
      await ctx.db.insert("channels", { serverId, name: "announcements", type: "announcement", topic: "Platform updates" });
      await ctx.db.insert("channels", { serverId, name: "voice lounge", type: "voice", topic: "Hop in and talk" });
      global = await ctx.db.get(serverId);
    }

    if (!global) throw new Error("Failed to initialize default server");

    const existingMember = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", global!._id))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!existingMember) {
      await ctx.db.insert("serverMembers", {
        serverId: global._id,
        userId,
        role: global.ownerId === userId ? "owner" : "member",
        joinedAt: Date.now(),
      });
    }

    return global._id;
  },
});

export const getServers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureAuthedUser(ctx);
    const memberships = await ctx.db.query("serverMembers").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const servers = await Promise.all(memberships.map((m) => ctx.db.get(m.serverId)));
    return servers.filter(Boolean);
  },
});

export const joinServerByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const server = await ctx.db
      .query("servers")
      .withIndex("by_invite", (q) => q.eq("inviteCode", args.inviteCode.trim()))
      .first();
    if (!server) return null;

    const existing = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", server._id))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (!existing) {
      await ctx.db.insert("serverMembers", {
        serverId: server._id,
        userId,
        role: "member",
        joinedAt: Date.now(),
      });
    }
    return server._id;
  },
});

export const createServer = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const slug = args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 12) || "srv";
    const inviteCode = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
    const serverId = await ctx.db.insert("servers", {
      name: args.name,
      ownerId: userId,
      icon: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(args.name)}`,
      inviteCode,
    });
    await ctx.db.insert("serverMembers", {
      serverId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
    await ctx.db.insert("channels", { serverId, name: "general", type: "text", topic: "General chat" });
    await ctx.db.insert("channels", { serverId, name: "voice", type: "voice", topic: "Voice channel" });
    return serverId;
  },
});

export const updateServerSettings = mutation({
  args: { serverId: v.id("servers"), name: v.optional(v.string()), icon: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const server = await ctx.db.get(args.serverId);
    if (!server) throw new Error("Server not found");
    if (server.ownerId !== userId) throw new Error("Only owner can update server settings");
    const patch: Record<string, unknown> = {};
    if (args.name) patch.name = args.name;
    if (args.icon) patch.icon = args.icon;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.serverId, patch);
    }
    return await ctx.db.get(args.serverId);
  },
});

export const getServerMembers = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    if (!(await isServerMember(ctx, args.serverId, userId))) return [];
    const members = await ctx.db.query("serverMembers").withIndex("by_server", (q) => q.eq("serverId", args.serverId)).collect();
    const users = await Promise.all(members.map((m) => ctx.db.get(m.userId)));
    return members.map((m, idx) => ({
      ...m,
      user: users[idx] || null,
    }));
  },
});

export const getChannels = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    if (!(await isServerMember(ctx, args.serverId, userId))) return [];
    return await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
  },
});

export const createChannel = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice"), v.literal("announcement")),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Insufficient permissions");
    }
    return await ctx.db.insert("channels", {
      serverId: args.serverId,
      name: args.name,
      type: args.type,
      topic: args.topic,
    });
  },
});

export const getMessages = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return [];
    if (!(await isServerMember(ctx, channel.serverId, userId))) return [];
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(100);
    const hydrated = await Promise.all(
      rows.map(async (m) => {
        if (!m.attachmentStorageId) return m;
        const url = await ctx.storage.getUrl(m.attachmentStorageId);
        return { ...m, attachmentUrl: url || m.attachmentUrl };
      }),
    );
    return hydrated;
  },
});

export const sendMessage = mutation({
  args: {
    channelId: v.id("channels"),
    content: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentUrl: v.optional(v.string()),
    attachmentType: v.optional(v.union(v.literal("image"), v.literal("voice"))),
  },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    await enforceRateLimit(ctx, `chat_msg:${userId}`, 30, 60_000);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (!(await isServerMember(ctx, channel.serverId, userId))) {
      throw new Error("Not a server member");
    }
    validateMessagePayload(args.content, args.attachmentType);
    if (args.attachmentStorageId) {
      await validateAttachmentStorage(ctx, args.attachmentStorageId, args.attachmentType);
    }
    const user = await ctx.db.get(userId);
    await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: userId,
      authorName: user?.username || "User",
      authorAvatar: user?.avatar,
      content: args.content,
      attachmentStorageId: args.attachmentStorageId,
      attachmentUrl: args.attachmentUrl,
      attachmentType: args.attachmentType,
      timestamp: Date.now(),
    });
  },
});

export const joinVoiceChannel = mutation({
  args: {
    channelId: v.id("channels"),
    muted: v.optional(v.boolean()),
    deafened: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.type !== "voice") throw new Error("Voice channel not found");
    if (!(await isServerMember(ctx, channel.serverId, userId))) throw new Error("Not a server member");

    const existingForUser = await ctx.db
      .query("voicePresence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existingForUser) await ctx.db.delete(existingForUser._id);

    const user = await ctx.db.get(userId);
    await ctx.db.insert("voicePresence", {
      serverId: channel.serverId,
      channelId: channel._id,
      userId,
      username: user?.username || "User",
      joinedAt: Date.now(),
      muted: Boolean(args.muted),
      deafened: Boolean(args.deafened),
    });
  },
});

export const leaveVoiceChannel = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureAuthedUser(ctx);
    const existing = await ctx.db
      .query("voicePresence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const listVoicePresence = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return [];
    if (!(await isServerMember(ctx, channel.serverId, userId))) return [];
    return await ctx.db.query("voicePresence").withIndex("by_channel", (q) => q.eq("channelId", args.channelId)).collect();
  },
});

export const startDmThread = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    if (userId === args.otherUserId) throw new Error("Cannot DM yourself");
    const key = pairKey(String(userId), String(args.otherUserId));
    const existing = await ctx.db.query("dmThreads").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (existing) return existing._id;

    return await ctx.db.insert("dmThreads", {
      key,
      participants: [userId, args.otherUserId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const listDmThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureAuthedUser(ctx);
    const all = await ctx.db.query("dmThreads").collect();
    const mine = all.filter((t) => t.participants.some((p) => p === userId));
    const users = await Promise.all(
      mine.map(async (t) => {
        const otherId = t.participants.find((p) => p !== userId);
        return otherId ? await ctx.db.get(otherId) : null;
      }),
    );
    return mine.map((t, i) => ({ ...t, otherUser: users[i] || null }));
  },
});

export const getDmMessages = query({
  args: { threadId: v.id("dmThreads") },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || !thread.participants.some((p) => p === userId)) return [];
    const rows = await ctx.db.query("dmMessages").withIndex("by_thread", (q) => q.eq("threadId", args.threadId)).order("desc").take(100);
    const hydrated = await Promise.all(
      rows.map(async (m) => {
        if (!m.attachmentStorageId) return m;
        const url = await ctx.storage.getUrl(m.attachmentStorageId);
        return { ...m, attachmentUrl: url || m.attachmentUrl };
      }),
    );
    return hydrated;
  },
});

export const sendDmMessage = mutation({
  args: {
    threadId: v.id("dmThreads"),
    content: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentUrl: v.optional(v.string()),
    attachmentType: v.optional(v.union(v.literal("image"), v.literal("voice"))),
  },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    await enforceRateLimit(ctx, `dm_msg:${userId}`, 30, 60_000);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || !thread.participants.some((p) => p === userId)) throw new Error("Thread not found");
    validateMessagePayload(args.content, args.attachmentType);
    if (args.attachmentStorageId) {
      await validateAttachmentStorage(ctx, args.attachmentStorageId, args.attachmentType);
    }
    const user = await ctx.db.get(userId);
    await ctx.db.insert("dmMessages", {
      threadId: args.threadId,
      senderId: userId,
      senderName: user?.username || "User",
      senderAvatar: user?.avatar,
      content: args.content,
      attachmentStorageId: args.attachmentStorageId,
      attachmentUrl: args.attachmentUrl,
      attachmentType: args.attachmentType,
      timestamp: Date.now(),
    });
    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
  },
});

export const generateAttachmentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureAuthedUser(ctx);
    await enforceRateLimit(ctx, `upload_url:${userId}`, 20, 60_000);
    return await ctx.storage.generateUploadUrl();
  },
});

export const enqueueAttachmentScan = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ensureAuthedUser(ctx);
    const existing = await ctx.db
      .query("attachmentScans")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .first();
    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("attachmentScans", {
        storageId: args.storageId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      return "pending";
    }
    return existing.status;
  },
});

export const markAttachmentScanResult = internalMutation({
  args: {
    storageId: v.id("_storage"),
    status: v.union(v.literal("clean"), v.literal("blocked")),
    scanner: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attachmentScans")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .first();
    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("attachmentScans", {
        storageId: args.storageId,
        status: args.status,
        scanner: args.scanner,
        reason: args.reason,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }
    await ctx.db.patch(existing._id, {
      status: args.status,
      scanner: args.scanner,
      reason: args.reason,
      updatedAt: now,
    });
  },
});

export const updateVoiceState = mutation({
  args: { muted: v.boolean(), deafened: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const existing = await ctx.db
      .query("voicePresence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, { muted: args.muted, deafened: args.deafened });
  },
});

export const sendVoiceSignal = mutation({
  args: {
    channelId: v.id("channels"),
    toUserId: v.id("users"),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    await enforceRateLimit(ctx, `voice_signal:${userId}`, 120, 60_000);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.type !== "voice") throw new Error("Voice channel not found");
    if (!(await isServerMember(ctx, channel.serverId, userId))) throw new Error("Not a server member");
    await ctx.db.insert("voiceSignals", {
      channelId: args.channelId,
      fromUserId: userId,
      toUserId: args.toUserId,
      kind: args.kind,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});

export const pullVoiceSignals = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.type !== "voice") return [];
    if (!(await isServerMember(ctx, channel.serverId, userId))) return [];

    const signals = await ctx.db
      .query("voiceSignals")
      .withIndex("by_to_user", (q) => q.eq("toUserId", userId))
      .filter((q) => q.eq(q.field("channelId"), args.channelId))
      .collect();

    for (const sig of signals) {
      await ctx.db.delete(sig._id);
    }
    return signals.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const listPendingVoiceSignals = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.type !== "voice") return [];
    if (!(await isServerMember(ctx, channel.serverId, userId))) return [];
    return await ctx.db
      .query("voiceSignals")
      .withIndex("by_to_user", (q) => q.eq("toUserId", userId))
      .filter((q) => q.eq(q.field("channelId"), args.channelId))
      .collect();
  },
});

export const ackVoiceSignals = mutation({
  args: { ids: v.array(v.id("voiceSignals")) },
  handler: async (ctx, args) => {
    const userId = await ensureAuthedUser(ctx);
    for (const id of args.ids) {
      const signal = await ctx.db.get(id);
      if (!signal) continue;
      if (signal.toUserId !== userId) continue;
      await ctx.db.delete(id);
    }
  },
});

export const cleanupStaleSignals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const staleSignalAgeMs = 2 * 60_000;
    const signals = await ctx.db.query("voiceSignals").collect();
    for (const sig of signals) {
      if (now - sig.createdAt > staleSignalAgeMs) {
        await ctx.db.delete(sig._id);
      }
    }

    const limitRows = await ctx.db.query("rateLimits").collect();
    for (const row of limitRows) {
      if (now - row.windowStart > 5 * 60_000) {
        await ctx.db.delete(row._id);
      }
    }

    const scans = await ctx.db.query("attachmentScans").collect();
    for (const s of scans) {
      if (s.status === "pending" && now - s.createdAt > 30 * 60_000) {
        await ctx.db.patch(s._id, {
          status: "blocked",
          reason: "Scan timeout",
          updatedAt: now,
        });
      } else if (now - s.updatedAt > 24 * 60 * 60_000) {
        await ctx.db.delete(s._id);
      }
    }
  },
});
