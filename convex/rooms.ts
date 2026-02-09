import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createRoom = mutation({
  args: { hostId: v.id("users") },
  handler: async (ctx, args) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: args.hostId,
      isLive: true,
    });
    return { roomId, code };
  },
});

export const joinRoom = mutation({
  args: { roomCode: v.string(), userId: v.id("users"), username: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db.query("rooms").withIndex("by_code", q => q.eq("code", args.roomCode)).first();
    if (!room) return null;

    // Remove existing participant record if any
    const existing = await ctx.db.query("participants")
      .withIndex("by_room", q => q.eq("roomId", room._id))
      .filter(q => q.eq(q.field("userId"), args.userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899'];
    await ctx.db.insert("participants", {
      roomId: room._id,
      userId: args.userId,
      username: args.username,
      color: colors[Math.floor(Math.random() * colors.length)],
      status: 'active',
      lastPing: Date.now(),
    });

    return room._id;
  },
});

export const ping = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const participant = await ctx.db.query("participants")
      .withIndex("by_room", q => q.eq("roomId", args.roomId))
      .filter(q => q.eq(q.field("userId"), args.userId))
      .first();
    if (participant) {
      await ctx.db.patch(participant._id, { lastPing: Date.now(), status: 'active' });
    }
  },
});

export const getParticipants = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    // Filter out stale participants (> 30s)
    const now = Date.now();
    const all = await ctx.db.query("participants").withIndex("by_room", q => q.eq("roomId", args.roomId!)).collect();
    return all.filter(p => now - p.lastPing < 30000);
  },
});

export const sendMessage = mutation({
  args: { roomId: v.id("rooms"), senderId: v.id("users"), senderName: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("roomMessages", { ...args, timestamp: Date.now() });
  },
});

export const getMessages = query({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    if (!args.roomId) return [];
    return await ctx.db.query("roomMessages").withIndex("by_room", q => q.eq("roomId", args.roomId!)).order("desc").take(50);
  },
});
