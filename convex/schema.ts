import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  
  // Users & Auth
  users: defineTable({
    username: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    password: v.optional(v.string()),
    image: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    avatar: v.optional(v.string()),
    banner: v.optional(v.string()),
    bio: v.optional(v.string()),
    isPro: v.optional(v.boolean()),
    isVerified: v.optional(v.boolean()),
    verificationCode: v.optional(v.string()),
    stats: v.optional(v.object({
      problemsSolved: v.number(),
      streak: v.number(),
      rank: v.string(),
      xp: v.number(),
    })),
    lastSolvedDay: v.optional(v.string()),
    longestStreak: v.optional(v.number()),
    friends: v.optional(v.array(v.id("users"))),
  })
  .index("by_username", ["username"])
  .index("email", ["email"]),

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
    role: v.optional(v.string()), // owner | editor | viewer
    status: v.string(), // active, idle
    currentFile: v.optional(v.string()),
    currentTask: v.optional(v.string()),
    cursorLine: v.optional(v.number()),
    cursorColumn: v.optional(v.number()),
    cursorPath: v.optional(v.string()),
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

  // Shared editor files inside a collaboration room
  roomFiles: defineTable({
    roomId: v.id("rooms"),
    path: v.string(),
    content: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_path", ["roomId", "path"]),

  roomFileLocks: defineTable({
    roomId: v.id("rooms"),
    path: v.string(),
    userId: v.id("users"),
    username: v.string(),
    acquiredAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_path", ["roomId", "path"])
    .index("by_user", ["userId"]),

  // Collaboration room voice presence/signaling
  roomVoicePresence: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    username: v.string(),
    joinedAt: v.number(),
    muted: v.boolean(),
    deafened: v.boolean(),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"]),

  roomVoiceSignals: defineTable({
    roomId: v.id("rooms"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
    createdAt: v.number(),
  })
    .index("by_to_user", ["toUserId"])
    .index("by_room", ["roomId"]),

  // Shared whiteboard snapshot + live cursors
  roomWhiteboards: defineTable({
    roomId: v.id("rooms"),
    snapshot: v.optional(v.string()), // data URL
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_room", ["roomId"]),

  roomWhiteboardPresence: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    username: v.string(),
    color: v.string(),
    cursorX: v.optional(v.number()),
    cursorY: v.optional(v.number()),
    isSharing: v.optional(v.boolean()),
    lastPing: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"]),

  // Community Posts
  posts: defineTable({
    authorId: v.id("users"),
    authorName: v.string(),
    authorAvatar: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentUrl: v.optional(v.string()),
    attachmentType: v.optional(v.string()), // image
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
    topic: v.optional(v.string()),
  }).index("by_server", ["serverId"]),

  // Chat Messages (Discord)
  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    authorName: v.string(),
    authorAvatar: v.optional(v.string()),
    content: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentUrl: v.optional(v.string()),
    attachmentType: v.optional(v.string()), // image | voice
    timestamp: v.number(),
  }).index("by_channel", ["channelId"]),

  // Server membership and roles
  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    role: v.string(), // owner | admin | member
    joinedAt: v.number(),
    nickname: v.optional(v.string()),
    muted: v.optional(v.boolean()),
    deafened: v.optional(v.boolean()),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"]),

  // Direct message threads between two users
  dmThreads: defineTable({
    key: v.string(), // sorted pair key: smallerId:largerId
    participants: v.array(v.id("users")), // length 2
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  dmMessages: defineTable({
    threadId: v.id("dmThreads"),
    senderId: v.id("users"),
    senderName: v.string(),
    senderAvatar: v.optional(v.string()),
    content: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentUrl: v.optional(v.string()),
    attachmentType: v.optional(v.string()), // image | voice
    timestamp: v.number(),
  }).index("by_thread", ["threadId"]),

  // Voice channel presence (no media transport; presence only)
  voicePresence: defineTable({
    serverId: v.id("servers"),
    channelId: v.id("channels"),
    userId: v.id("users"),
    username: v.string(),
    joinedAt: v.number(),
    muted: v.boolean(),
    deafened: v.boolean(),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"]),

  // Signaling messages for WebRTC voice calls
  voiceSignals: defineTable({
    channelId: v.id("channels"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(), // JSON SDP / ICE payload
    createdAt: v.number(),
  })
    .index("by_to_user", ["toUserId"])
    .index("by_channel", ["channelId"]),

  // Generic rate-limit counters
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
    updatedAt: v.number(),
  }).index("by_key_window", ["key", "windowStart"]),

  attachmentScans: defineTable({
    storageId: v.id("_storage"),
    status: v.union(v.literal("pending"), v.literal("clean"), v.literal("blocked")),
    scanner: v.optional(v.string()),
    reason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_storage_id", ["storageId"]),

  // User Files
  files: defineTable({
    userId: v.id("users"),
    path: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Billing / Pro upgrades
  proUpgrades: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("failed")),
    amountCents: v.number(),
    currency: v.string(),
    paymentRef: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Approved/public challenges
  challenges: defineTable({
    title: v.string(),
    slug: v.string(),
    difficulty: v.union(v.literal("Easy"), v.literal("Medium"), v.literal("Hard")),
    description: v.string(),
    functionName: v.string(),
    starterCodeByLanguage: v.record(v.string(), v.string()),
    testCases: v.array(
      v.object({
        name: v.string(),
        inputJson: v.string(),
        expectedJson: v.string(),
      }),
    ),
    tags: v.array(v.string()),
    companyTags: v.array(v.string()),
    demandScore: v.number(),
    source: v.union(v.literal("seed"), v.literal("user"), v.literal("ai")),
    status: v.union(v.literal("approved"), v.literal("archived")),
    createdBy: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status_difficulty", ["status", "difficulty"])
    .index("by_source", ["source"]),

  // User or AI proposals waiting for moderation
  challengeSubmissions: defineTable({
    title: v.string(),
    slug: v.string(),
    difficulty: v.union(v.literal("Easy"), v.literal("Medium"), v.literal("Hard")),
    description: v.string(),
    functionName: v.string(),
    starterCodeByLanguage: v.record(v.string(), v.string()),
    testCases: v.array(
      v.object({
        name: v.string(),
        inputJson: v.string(),
        expectedJson: v.string(),
      }),
    ),
    tags: v.array(v.string()),
    companyTags: v.array(v.string()),
    demandScore: v.number(),
    source: v.union(v.literal("user"), v.literal("ai")),
    status: v.union(
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("needs_changes"),
    ),
    submittedBy: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    moderationNote: v.optional(v.string()),
    validationErrors: v.array(v.string()),
    securityFlags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_slug", ["slug"]),

  // Lightweight per-user challenge activity stats
  challengeActivity: defineTable({
    challengeKey: v.string(),
    userId: v.id("users"),
    tries: v.number(),
    accepted: v.boolean(),
    lastActiveAt: v.number(),
  })
    .index("by_challenge", ["challengeKey"])
    .index("by_user_challenge", ["userId", "challengeKey"]),

  // Solution attempt records for user history/submissions
  challengeSolutions: defineTable({
    challengeKey: v.string(),
    userId: v.id("users"),
    language: v.string(),
    fileName: v.string(),
    code: v.string(),
    passed: v.boolean(),
    totalCases: v.number(),
    passedCases: v.number(),
    submittedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_challenge", ["userId", "challengeKey"])
    .index("by_challenge", ["challengeKey"]),
});
