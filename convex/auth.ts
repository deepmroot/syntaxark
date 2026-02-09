import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [GitHub, Google],
});

// Validation queries
export const checkUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
    return { available: !existing };
  },
});

export const checkEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return { available: !existing };
  },
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user || user.password !== args.password) {
      return null;
    }
    return user;
  },
});

export const signUp = mutation({
  args: { username: v.string(), email: v.string(), password: v.string(), bio: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Check username
    const existingUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
    if (existingUsername) return { error: "Username already taken" };

    // Check email
    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingEmail) return { error: "Email already in use" };

    // Validate password
    if (args.password.length < 6) return { error: "Password must be at least 6 characters" };

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const id = await ctx.db.insert("users", {
      username: args.username,
      email: args.email,
      password: args.password,
      bio: args.bio,
      isPro: false,
      isVerified: false,
      verificationCode,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${args.username}`,
      banner: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80',
      stats: { problemsSolved: 0, streak: 1, rank: 'Cadet', xp: 100 },
      friends: [],
    });

    return { user: await ctx.db.get(id), code: verificationCode };
  },
});

// OAuth login (creates or returns existing user)
export const oauthLogin = mutation({
  args: { 
    provider: v.string(), 
    providerId: v.string(), 
    email: v.string(), 
    username: v.string(),
    avatar: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Check if user exists by email
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (user) {
      return user;
    }

    // Create new user
    const id = await ctx.db.insert("users", {
      username: args.username,
      email: args.email,
      password: `oauth_${args.provider}_${args.providerId}`, // OAuth users don't have real passwords
      isPro: false,
      isVerified: true, // OAuth users are pre-verified
      avatar: args.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${args.username}`,
      banner: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80',
      stats: { problemsSolved: 0, streak: 1, rank: 'Cadet', xp: 100 },
      friends: [],
    });

    return await ctx.db.get(id);
  },
});

export const verifyEmail = mutation({
  args: { userId: v.id("users"), code: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.verificationCode !== args.code) {
      return false;
    }
    await ctx.db.patch(args.userId, { isVerified: true, verificationCode: undefined });
    return true;
  },
});
