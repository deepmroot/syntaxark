import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const ONLINE_WINDOW_MS = 45_000;

const defaultAvatar = (seedRaw: string) => {
  const seed = encodeURIComponent(seedRaw || "user");
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
};

const toPublicUser = (user: any) => ({
  _id: user._id,
  username: user.username || "user",
  email: user.email,
  avatar: user.avatar || user.image || defaultAvatar(user.username || user.email || String(user._id)),
  preferredLanguage: user.preferredLanguage || "javascript",
  banner: user.banner,
  bio: user.bio,
  isPro: Boolean(user.isPro),
  isVerified: Boolean(user.isVerified),
  stats: user.stats || { problemsSolved: 0, streak: 0, rank: "Cadet", xp: 100 },
  friends: user.friends || [],
});

const getOnlineUserIdSet = async (ctx: any) => {
  const now = Date.now();
  const online = new Set<string>();

  const [participants, roomVoice, communityVoice] = await Promise.all([
    ctx.db.query("participants").collect(),
    ctx.db.query("roomVoicePresence").collect(),
    ctx.db.query("voicePresence").collect(),
  ]);

  participants.forEach((p: any) => {
    if (typeof p.lastPing === "number" && now - p.lastPing <= ONLINE_WINDOW_MS) {
      online.add(String(p.userId));
    }
  });
  roomVoice.forEach((p: any) => online.add(String(p.userId)));
  communityVoice.forEach((p: any) => online.add(String(p.userId)));

  return online;
};

export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getPublicProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const viewerId = await getAuthUserId(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const friends = user.friends || [];
    const friendUsers = await Promise.all(
      friends.slice(0, 12).map(async (friendId) => {
        const friend = await ctx.db.get(friendId);
        if (!friend) return null;
        return {
          _id: friend._id,
          username: friend.username || "user",
          avatar: friend.avatar || friend.image || defaultAvatar(friend.username || friend.email || String(friend._id)),
          isPro: Boolean(friend.isPro),
        };
      }),
    );

    const projects = await ctx.db
      .query("files")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(8);

    const authoredPosts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("authorId"), args.userId))
      .order("desc")
      .take(6);

    const [activityRows, solutionRows] = await Promise.all([
      ctx.db
        .query("challengeActivity")
        .withIndex("by_user_challenge", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("challengeSolutions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(20),
    ]);
    const acceptedCount = activityRows.reduce((acc: number, row: any) => acc + (row.accepted ? 1 : 0), 0);
    const triedCount = activityRows.reduce((acc: number, row: any) => acc + Math.max(0, Number(row.tries || 0)), 0);
    const submissionCount = solutionRows.length;
    const passedSubmissionCount = solutionRows.reduce((acc: number, row: any) => acc + (row.passed ? 1 : 0), 0);

    return {
      user: toPublicUser(user),
      friends: friendUsers.filter(Boolean),
      recentProjects: projects.map((project) => ({
        _id: project._id,
        path: project.path,
        updatedAt: project.updatedAt,
      })),
      recentPosts: authoredPosts.map((post) => ({
        _id: post._id,
        title: post.title,
        type: post.type,
        likes: post.likes,
        timestamp: post.timestamp,
      })),
      counts: {
        friends: friends.length,
        projects: projects.length,
        posts: authoredPosts.length,
        submissions: submissionCount,
        acceptedSubmissions: passedSubmissionCount,
        solvedChallenges: acceptedCount,
        totalTries: triedCount,
      },
      challengeRecord: {
        solvedChallenges: acceptedCount,
        totalTries: triedCount,
        submissions: submissionCount,
        acceptedSubmissions: passedSubmissionCount,
        recentSubmissions: solutionRows.map((row: any) => ({
          _id: row._id,
          challengeKey: row.challengeKey,
          language: row.language,
          passed: row.passed,
          passedCases: row.passedCases,
          totalCases: row.totalCases,
          submittedAt: row.submittedAt,
        })),
      },
      relationship: {
        isSelf: Boolean(viewerId && viewerId === args.userId),
        isFriend: Boolean(viewerId && friends.includes(viewerId)),
      },
    };
  },
});

export const getMyFriends = query({
  args: {},
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) return [];

    const me = await ctx.db.get(authUserId);
    if (!me) return [];

    const friendIds = (me.friends || []) as any[];
    if (friendIds.length === 0) return [];

    const [onlineIds, rows] = await Promise.all([
      getOnlineUserIdSet(ctx),
      Promise.all(friendIds.map((id) => ctx.db.get(id))),
    ]);

    return rows
      .filter(Boolean)
      .map((u: any) => ({
        _id: u._id,
        username: u.username || "user",
        email: u.email,
        avatar: u.avatar || u.image || defaultAvatar(u.username || u.email || String(u._id)),
        isPro: Boolean(u.isPro),
        isOnline: onlineIds.has(String(u._id)),
      }))
      .sort((a: any, b: any) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return a.username.localeCompare(b.username);
      });
  },
});

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) return [];
    const me = await ctx.db.get(authUserId);
    if (!me) return [];
    const myFriends = new Set<string>((me.friends || []).map((id: any) => String(id)));
    const q = args.query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const [rows, onlineIds] = await Promise.all([
      ctx.db.query("users").take(300),
      getOnlineUserIdSet(ctx),
    ]);
    return rows
      .filter((u: any) => {
        const username = String(u.username || "").toLowerCase();
        const email = String(u.email || "").toLowerCase();
        return username.includes(q) || email.includes(q);
      })
      .filter((u: any) => u._id !== authUserId)
      .slice(0, 20)
      .map((u: any) => ({
        _id: u._id,
        username: u.username || "user",
        email: u.email,
        avatar: u.avatar || u.image || defaultAvatar(u.username || u.email || String(u._id)),
        isPro: Boolean(u.isPro),
        isFriend: myFriends.has(String(u._id)),
        isOnline: onlineIds.has(String(u._id)),
      }));
  },
});

export const addFriend = mutation({
  args: { friendId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (userId === args.friendId) throw new Error("Cannot add yourself");

    const [me, other] = await Promise.all([ctx.db.get(userId), ctx.db.get(args.friendId)]);
    if (!me || !other) throw new Error("User not found");

    const myFriends = me.friends || [];
    const otherFriends = other.friends || [];

    if (!myFriends.includes(args.friendId)) {
      await ctx.db.patch(userId, { friends: [...myFriends, args.friendId] });
    }
    if (!otherFriends.includes(userId)) {
      await ctx.db.patch(args.friendId, { friends: [...otherFriends, userId] });
    }

    return { ok: true };
  },
});

export const removeFriend = mutation({
  args: { friendId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const [me, other] = await Promise.all([ctx.db.get(userId), ctx.db.get(args.friendId)]);
    if (!me || !other) throw new Error("User not found");

    await ctx.db.patch(userId, {
      friends: (me.friends || []).filter((id: any) => id !== args.friendId),
    });
    await ctx.db.patch(args.friendId, {
      friends: (other.friends || []).filter((id: any) => id !== userId),
    });

    return { ok: true };
  },
});

export const updateProfile = mutation({
  args: { 
    userId: v.id("users"), 
    bio: v.optional(v.string()), 
    banner: v.optional(v.string()),
    avatar: v.optional(v.string()),
    bannerStorageId: v.optional(v.id("_storage")),
    avatarStorageId: v.optional(v.id("_storage")),
    preferredLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId || authUserId !== args.userId) {
      throw new Error("Unauthorized");
    }
    const { userId, bannerStorageId, avatarStorageId, ...updates } = args;
    if (bannerStorageId) {
      const bannerUrl = await ctx.storage.getUrl(bannerStorageId);
      if (!bannerUrl) throw new Error("Failed to resolve banner upload URL");
      updates.banner = bannerUrl;
    }
    if (avatarStorageId) {
      const avatarUrl = await ctx.storage.getUrl(avatarStorageId);
      if (!avatarUrl) throw new Error("Failed to resolve avatar upload URL");
      updates.avatar = avatarUrl;
    }
    await ctx.db.patch(userId, updates);
    return await ctx.db.get(userId);
  },
});

export const upgradeToPro = mutation({
  args: { userId: v.id("users") },
  handler: async (_ctx, _args) => {
    throw new Error("Direct Pro upgrades are disabled. Use billing request + webhook confirmation.");
  },
});

export const checkAvailability = query({
  args: { username: v.optional(v.string()), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.username) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", args.username!))
        .first();
      if (existing) return { available: false, reason: "Username already taken" };
    }
    if (args.email) {
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", args.email!))
        .first();
      if (existing) return { available: false, reason: "Email already in use" };
    }
    return { available: true };
  },
});
