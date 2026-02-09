import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getServers = query({
  handler: async (ctx) => {
    // In a real app, filter by user membership. For now, return all public ones.
    return await ctx.db.query("servers").take(20);
  },
});

export const getChannels = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
  },
});

export const getMessages = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(50);
  },
});

export const sendMessage = mutation({
  args: {
    channelId: v.id("channels"),
    authorId: v.id("users"),
    authorName: v.string(),
    authorAvatar: v.optional(v.string()),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const createServer = mutation({
  args: { name: v.string(), ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const serverId = await ctx.db.insert("servers", {
      name: args.name,
      ownerId: args.ownerId,
      icon: `https://api.dicebear.com/7.x/initials/svg?seed=${args.name}`,
      inviteCode: Math.random().toString(36).substring(7),
    });

    await ctx.db.insert("channels", {
      serverId,
      name: "general",
      type: "text",
    });

    return serverId;
  },
});
