import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const requireAuthedUser = async (ctx: any) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");
  return userId as Id<"users">;
};

const ensureRoomMember = async (
  ctx: any,
  roomId: Id<"rooms">,
  userId: Id<"users">,
) => {
  return await ctx.db
    .query("participants")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .first();
};

const canEditInRoom = (member: any) => {
  const role = member?.role || "editor";
  return role === "owner" || role === "editor";
};

const LOCK_TTL_MS = 20_000;

const getActiveFileLock = async (ctx: any, roomId: Id<"rooms">, path: string) => {
  const lock = await ctx.db
    .query("roomFileLocks")
    .withIndex("by_room_path", (q: any) => q.eq("roomId", roomId).eq("path", path))
    .first();
  if (!lock) return null;
  if (lock.expiresAt < Date.now()) {
    await ctx.db.delete(lock._id);
    return null;
  }
  return lock;
};

const upsertWhiteboardPresence = async (
  ctx: any,
  args: {
    roomId: Id<"rooms">;
    userId: Id<"users">;
    username: string;
    color: string;
    cursorX?: number;
    cursorY?: number;
    isSharing?: boolean;
  },
) => {
  const existing = await ctx.db
    .query("roomWhiteboardPresence")
    .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
    .filter((q: any) => q.eq(q.field("roomId"), args.roomId))
    .first();
  const patch = {
    roomId: args.roomId,
    userId: args.userId,
    username: args.username,
    color: args.color,
    cursorX: args.cursorX,
    cursorY: args.cursorY,
    isSharing: args.isSharing,
    lastPing: Date.now(),
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }
  await ctx.db.insert("roomWhiteboardPresence", patch);
};

export const createRoom = mutation({
  args: { hostId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.hostId) throw new Error("Unauthorized");
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: args.hostId,
      isLive: true,
    });
    await ctx.db.insert("roomWhiteboards", {
      roomId,
      updatedAt: Date.now(),
    });
    return { roomId, code };
  },
});

export const getRoomByCode = query({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    await requireAuthedUser(ctx);
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode.toUpperCase()))
      .first();
  },
});

export const getRoom = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return null;
    const userId = await requireAuthedUser(ctx);
    const member = await ensureRoomMember(ctx, args.roomId, userId);
    if (!member) return null;
    return await ctx.db.get(args.roomId);
  },
});

export const joinRoom = mutation({
  args: { roomCode: v.string(), userId: v.id("users"), username: v.string() },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode.toUpperCase()))
      .first();
    if (!room) return null;

    const existing = await ensureRoomMember(ctx, room._id, args.userId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        username: args.username,
        status: "active",
        lastPing: Date.now(),
      });
      return room._id;
    }

    const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const role = room.hostId === args.userId ? "owner" : "editor";
    await ctx.db.insert("participants", {
      roomId: room._id,
      userId: args.userId,
      username: args.username,
      color,
      role,
      status: "active",
      lastPing: Date.now(),
    });

    await upsertWhiteboardPresence(ctx, {
      roomId: room._id,
      userId: args.userId,
      username: args.username,
      color,
      isSharing: false,
    });

    return room._id;
  },
});

export const assignRole = mutation({
  args: {
    roomId: v.id("rooms"),
    targetUserId: v.id("users"),
    role: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== authUserId) throw new Error("Only room owner can assign roles");

    const target = await ensureRoomMember(ctx, args.roomId, args.targetUserId);
    if (!target) throw new Error("Target user is not in this room");
    await ctx.db.patch(target._id, { role: args.role });
    return { ok: true };
  },
});

export const updatePresenceContext = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.id("users"),
    status: v.optional(v.string()),
    currentFile: v.optional(v.string()),
    currentTask: v.optional(v.string()),
    cursorLine: v.optional(v.number()),
    cursorColumn: v.optional(v.number()),
    cursorPath: v.optional(v.string()),
    isSharingWhiteboard: v.optional(v.boolean()),
    cursorX: v.optional(v.number()),
    cursorY: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const participant = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!participant) throw new Error("Not a room member");

    await ctx.db.patch(participant._id, {
      status: args.status ?? participant.status,
      currentFile: args.currentFile ?? participant.currentFile,
      currentTask: args.currentTask ?? participant.currentTask,
      cursorLine: args.cursorLine ?? participant.cursorLine,
      cursorColumn: args.cursorColumn ?? participant.cursorColumn,
      cursorPath: args.cursorPath ?? participant.cursorPath,
      lastPing: Date.now(),
    });

    await upsertWhiteboardPresence(ctx, {
      roomId: args.roomId,
      userId: args.userId,
      username: participant.username,
      color: participant.color,
      cursorX: args.cursorX,
      cursorY: args.cursorY,
      isSharing: args.isSharingWhiteboard,
    });
  },
});

export const ping = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const participant = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!participant) return;
    await ctx.db.patch(participant._id, { lastPing: Date.now(), status: "active" });
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const participant = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (participant) await ctx.db.delete(participant._id);

    const wbPresence = await ctx.db
      .query("roomWhiteboardPresence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .first();
    if (wbPresence) await ctx.db.delete(wbPresence._id);

    const voicePresence = await ctx.db
      .query("roomVoicePresence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .first();
    if (voicePresence) await ctx.db.delete(voicePresence._id);

    const locks = await ctx.db
      .query("roomFileLocks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .collect();
    for (const lock of locks) await ctx.db.delete(lock._id);
  },
});

export const dismantleRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return { ok: true };
    if (room.hostId !== authUserId) throw new Error("Only owner can dismantle room");

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const p of participants) await ctx.db.delete(p._id);

    const messages = await ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const m of messages) await ctx.db.delete(m._id);

    const wb = await ctx.db
      .query("roomWhiteboards")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const row of wb) await ctx.db.delete(row._id);

    const wbPresence = await ctx.db
      .query("roomWhiteboardPresence")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const row of wbPresence) await ctx.db.delete(row._id);

    const voicePresence = await ctx.db
      .query("roomVoicePresence")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const row of voicePresence) await ctx.db.delete(row._id);

    const files = await ctx.db
      .query("roomFiles")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const row of files) await ctx.db.delete(row._id);

    const locks = await ctx.db
      .query("roomFileLocks")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const row of locks) await ctx.db.delete(row._id);

    const signals = await ctx.db
      .query("roomVoiceSignals")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const row of signals) await ctx.db.delete(row._id);

    await ctx.db.delete(args.roomId);
    return { ok: true };
  },
});

export const getParticipants = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    const roomId = args.roomId;
    const authUserId = await requireAuthedUser(ctx);
    const membership = await ensureRoomMember(ctx, roomId, authUserId);
    if (!membership) return [];
    const now = Date.now();
    const all = await ctx.db
      .query("participants")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    return all.filter((p) => now - p.lastPing < 30_000);
  },
});

export const sendMessage = mutation({
  args: { roomId: v.id("rooms"), senderId: v.id("users"), senderName: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.senderId) throw new Error("Unauthorized");
    const membership = await ensureRoomMember(ctx, args.roomId, args.senderId);
    if (!membership) throw new Error("Not a room member");
    await ctx.db.insert("roomMessages", { ...args, timestamp: Date.now() });
  },
});

export const getMessages = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    const roomId = args.roomId;
    const authUserId = await requireAuthedUser(ctx);
    const membership = await ensureRoomMember(ctx, roomId, authUserId);
    if (!membership) return [];
    return await ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(100);
  },
});

export const listRoomFiles = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    const authUserId = await requireAuthedUser(ctx);
    const membership = await ensureRoomMember(ctx, args.roomId, authUserId);
    if (!membership) return [];
    return await ctx.db
      .query("roomFiles")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId!))
      .order("desc")
      .take(500);
  },
});

export const initializeSharedWorkspace = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.id("users"),
    files: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const membership = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!membership) throw new Error("Not a room member");
    if (!canEditInRoom(membership)) throw new Error("Read-only role");

    const now = Date.now();
    for (const file of args.files.slice(0, 200)) {
      const lock = await getActiveFileLock(ctx, args.roomId, file.path);
      if (lock && lock.userId !== args.userId) continue;
      const existing = await ctx.db
        .query("roomFiles")
        .withIndex("by_room_path", (q) => q.eq("roomId", args.roomId).eq("path", file.path))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          content: file.content,
          updatedBy: args.userId,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("roomFiles", {
          roomId: args.roomId,
          path: file.path,
          content: file.content,
          updatedBy: args.userId,
          updatedAt: now,
        });
      }
    }
    return { ok: true };
  },
});

export const getRoomFileLocks = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    const authUserId = await requireAuthedUser(ctx);
    const membership = await ensureRoomMember(ctx, args.roomId, authUserId);
    if (!membership) return [];
    const locks = await ctx.db
      .query("roomFileLocks")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId!))
      .collect();
    const now = Date.now();
    return locks.filter((lock) => lock.expiresAt >= now);
  },
});

export const acquireRoomFileLock = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users"), path: v.string() },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const membership = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!membership) throw new Error("Not a room member");
    if (!canEditInRoom(membership)) throw new Error("Read-only role");

    const now = Date.now();
    const existing = await getActiveFileLock(ctx, args.roomId, args.path);
    if (existing && existing.userId !== args.userId) {
      throw new Error(`File is locked by ${existing.username}`);
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        expiresAt: now + LOCK_TTL_MS,
      });
      return existing._id;
    }
    return await ctx.db.insert("roomFileLocks", {
      roomId: args.roomId,
      path: args.path,
      userId: args.userId,
      username: membership.username,
      acquiredAt: now,
      expiresAt: now + LOCK_TTL_MS,
    });
  },
});

export const releaseRoomFileLock = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users"), path: v.string() },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("roomFileLocks")
      .withIndex("by_room_path", (q) => q.eq("roomId", args.roomId).eq("path", args.path))
      .first();
    if (!existing) return;
    if (existing.userId !== args.userId) return;
    await ctx.db.delete(existing._id);
  },
});

export const upsertRoomFile = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.id("users"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const membership = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!membership) throw new Error("Not a room member");
    if (!canEditInRoom(membership)) throw new Error("Read-only role");

    const lock = await getActiveFileLock(ctx, args.roomId, args.path);
    if (lock && lock.userId !== args.userId) {
      throw new Error(`File is locked by ${lock.username}`);
    }
    if (lock && lock.userId === args.userId) {
      await ctx.db.patch(lock._id, { expiresAt: Date.now() + LOCK_TTL_MS });
    }

    const existing = await ctx.db
      .query("roomFiles")
      .withIndex("by_room_path", (q) => q.eq("roomId", args.roomId).eq("path", args.path))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        updatedBy: args.userId,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("roomFiles", {
      roomId: args.roomId,
      path: args.path,
      content: args.content,
      updatedBy: args.userId,
      updatedAt: now,
    });
  },
});

export const getWhiteboardSnapshot = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return null;
    const authUserId = await requireAuthedUser(ctx);
    const membership = await ensureRoomMember(ctx, args.roomId, authUserId);
    if (!membership) return null;
    return await ctx.db
      .query("roomWhiteboards")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId!))
      .first();
  },
});

export const updateWhiteboardSnapshot = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users"), snapshot: v.string() },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const membership = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!membership) throw new Error("Not a room member");
    if (args.snapshot.length > 2_500_000) throw new Error("Whiteboard snapshot too large");

    const existing = await ctx.db
      .query("roomWhiteboards")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
    if (!existing) {
      await ctx.db.insert("roomWhiteboards", {
        roomId: args.roomId,
        snapshot: args.snapshot,
        updatedBy: args.userId,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(existing._id, {
      snapshot: args.snapshot,
      updatedBy: args.userId,
      updatedAt: Date.now(),
    });
  },
});

export const getWhiteboardPresence = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    const authUserId = await requireAuthedUser(ctx);
    const membership = await ensureRoomMember(ctx, args.roomId, authUserId);
    if (!membership) return [];
    const now = Date.now();
    const rows = await ctx.db
      .query("roomWhiteboardPresence")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId!))
      .collect();
    return rows.filter((row) => now - row.lastPing < 30_000);
  },
});

export const updateWhiteboardCursor = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.id("users"),
    cursorX: v.number(),
    cursorY: v.number(),
    isSharing: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const participant = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!participant) throw new Error("Not a room member");
    await upsertWhiteboardPresence(ctx, {
      roomId: args.roomId,
      userId: args.userId,
      username: participant.username,
      color: participant.color,
      cursorX: args.cursorX,
      cursorY: args.cursorY,
      isSharing: args.isSharing,
    });
  },
});

export const listRoomVoicePresence = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    const authUserId = await requireAuthedUser(ctx);
    const membership = await ensureRoomMember(ctx, args.roomId, authUserId);
    if (!membership) return [];
    return await ctx.db
      .query("roomVoicePresence")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId!))
      .collect();
  },
});

export const joinRoomVoice = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.id("users"),
    muted: v.optional(v.boolean()),
    deafened: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const participant = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!participant) throw new Error("Not a room member");

    const existing = await ctx.db
      .query("roomVoicePresence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    await ctx.db.insert("roomVoicePresence", {
      roomId: args.roomId,
      userId: args.userId,
      username: participant.username,
      joinedAt: Date.now(),
      muted: Boolean(args.muted),
      deafened: Boolean(args.deafened),
    });
  },
});

export const leaveRoomVoice = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("roomVoicePresence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const updateRoomVoiceState = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users"), muted: v.boolean(), deafened: v.boolean() },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("roomVoicePresence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, { muted: args.muted, deafened: args.deafened });
  },
});

export const sendRoomVoiceSignal = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.id("users"),
    toUserId: v.id("users"),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    const membership = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!membership) throw new Error("Not a room member");
    await ctx.db.insert("roomVoiceSignals", {
      roomId: args.roomId,
      fromUserId: args.userId,
      toUserId: args.toUserId,
      kind: args.kind,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});

export const listPendingRoomVoiceSignals = query({
  args: { roomId: v.optional(v.id("rooms")), userId: v.id("users") },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) return [];
    const membership = await ensureRoomMember(ctx, args.roomId, args.userId);
    if (!membership) return [];
    return await ctx.db
      .query("roomVoiceSignals")
      .withIndex("by_to_user", (q) => q.eq("toUserId", args.userId))
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .collect();
  },
});

export const ackRoomVoiceSignals = mutation({
  args: { ids: v.array(v.id("roomVoiceSignals")), userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await requireAuthedUser(ctx);
    if (authUserId !== args.userId) throw new Error("Unauthorized");
    for (const id of args.ids) {
      const signal = await ctx.db.get(id);
      if (!signal) continue;
      if (signal.toUserId !== args.userId) continue;
      await ctx.db.delete(id);
    }
  },
});
