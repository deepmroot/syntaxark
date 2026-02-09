import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  
  // Users & Auth
  users: defineTable({
    username: v.string(),
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    avatar: v.optional(v.string()),
    banner: v.optional(v.string()),
    bio: v.optional(v.string()),
    isPro: v.boolean(),
    isVerified: v.optional(v.boolean()),
    verificationCode: v.optional(v.string()),
    stats: v.object({
      problemsSolved: v.number(),
      streak: v.number(),
      rank: v.string(),
      xp: v.number(),
    }),
    friends: v.array(v.id("users")),
  })
  .index("by_username", ["username"])
  .index("by_email", ["email"]),

  // Collaboration Rooms
  rooms: defineTable({
    code: v.string(),
    hostId: v.id("users"),
    isLive: v.boolean(),
    activeFile: v.optional(v.string()),
  }).index("by_code", ["code"]),

  // Room Participants (Presence)
  participants: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    username: v.string(),
    color: v.string(),
    status: v.string(), // active, idle
    currentFile: v.optional(v.string()),
    lastPing: v.number(),
  }).index("by_room", ["roomId"]),

  // Collaboration Chat (Ephemeral)
  roomMessages: defineTable({
    roomId: v.id("rooms"),
    senderId: v.id("users"),
    senderName: v.string(),
    content: v.string(),
    timestamp: v.number(),
  }).index("by_room", ["roomId"]),

  // Community Posts
  posts: defineTable({
    authorId: v.id("users"),
    authorName: v.string(),
    authorAvatar: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    codeSnippet: v.optional(v.string()),
    language: v.optional(v.string()),
    tags: v.array(v.string()),
    likes: v.number(),
    timestamp: v.number(),
  }),

  // Post Comments
  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.id("users"),
    authorName: v.string(),
    text: v.string(),
    timestamp: v.number(),
  }).index("by_post", ["postId"]),

  // Discord-like Servers
  servers: defineTable({
    name: v.string(),
    icon: v.string(),
    ownerId: v.id("users"),
    inviteCode: v.string(),
  }).index("by_invite", ["inviteCode"]),

  // Server Channels
  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    type: v.string(),
  }).index("by_server", ["serverId"]),

  // Chat Messages (Discord)
  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    authorName: v.string(),
    authorAvatar: v.optional(v.string()),
    content: v.string(),
    timestamp: v.number(),
  }).index("by_channel", ["channelId"]),

  // User Files
  files: defineTable({
    userId: v.id("users"),
    path: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});