import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const DEFAULT_STATS = { problemsSolved: 0, streak: 0, rank: "Cadet", xp: 100 };
const DEFAULT_PREFERRED_LANGUAGE = "javascript";
const LEGACY_BANNER_URL = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80";
const BANNER_PALETTES = [
  ["#0ea5e9", "#6366f1"],
  ["#f97316", "#ef4444"],
  ["#10b981", "#22d3ee"],
  ["#eab308", "#f97316"],
  ["#ec4899", "#8b5cf6"],
  ["#14b8a6", "#3b82f6"],
] as const;

const sanitizeUsernameBase = (value: string) => {
  const base = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16);
  return base.length >= 3 ? base : "user";
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const pickPalette = (seed: string) => BANNER_PALETTES[hashString(seed) % BANNER_PALETTES.length];

const buildDefaultBanner = (seed: string) => {
  const [c1, c2] = pickPalette(seed);
  const h = hashString(seed);
  const x = 180 + (h % 840);
  const y = 40 + ((h >> 3) % 240);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1200" height="320" fill="url(#g)"/><circle cx="${x}" cy="${y}" r="210" fill="white" fill-opacity="0.12"/><circle cx="${1200 - x}" cy="${320 - y}" r="170" fill="white" fill-opacity="0.1"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const buildDefaultAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

const isBrokenLegacyBanner = (banner?: string) =>
  !banner || banner === LEGACY_BANNER_URL || banner.includes("images.unsplash.com/photo-1579546929518-9e396f3cc809");

const buildUniqueUsername = async (
  ctx: QueryCtx | MutationCtx,
  seed: string,
) => {
  const base = sanitizeUsernameBase(seed);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", candidate))
      .first();
    if (!existing) return candidate;

    const suffixText = `_${suffix}`;
    const prefixLen = Math.max(3, 16 - suffixText.length);
    candidate = `${base.slice(0, prefixLen)}${suffixText}`;
    suffix += 1;
  }
};

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
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return { available: !existing };
  },
});

export const login = mutation({
  args: { identifier: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const identifier = args.identifier.trim().toLowerCase();

    const byEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identifier))
      .first();

    let user =
      byEmail ||
      (await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", identifier))
        .first());

    if (!user || user.password !== args.password) {
      return null;
    }

    const seed = user.username || user.email?.split("@")[0] || String(user._id);
    const patch: Record<string, unknown> = {};
    if (!user.avatar) patch.avatar = buildDefaultAvatar(seed);
    if (isBrokenLegacyBanner(user.banner)) patch.banner = buildDefaultBanner(seed);
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
      user = await ctx.db.get(user._id);
      if (!user) return null;
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
      .withIndex("email", (q) => q.eq("email", args.email))
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
      avatar: buildDefaultAvatar(args.username),
      banner: buildDefaultBanner(args.username),
      stats: { problemsSolved: 0, streak: 0, rank: 'Cadet', xp: 100 },
      friends: [],
      preferredLanguage: DEFAULT_PREFERRED_LANGUAGE,
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
      .withIndex("email", (q) => q.eq("email", args.email))
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
      avatar: args.avatar || buildDefaultAvatar(args.username),
      banner: buildDefaultBanner(args.username),
      stats: { problemsSolved: 0, streak: 0, rank: 'Cadet', xp: 100 },
      friends: [],
      preferredLanguage: DEFAULT_PREFERRED_LANGUAGE,
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

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const ensureCurrentUserProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;
    const authUser = user as typeof user & {
      name?: string;
      image?: string;
      emailVerificationTime?: number;
    };

    const patch: Record<string, unknown> = {};

    const usernameSeed = authUser.name || user.email?.split("@")[0] || "user";
    if (!user.username) {
      patch.username = await buildUniqueUsername(ctx, usernameSeed);
    } else {
      const duplicate = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", user.username))
        .first();
      if (duplicate && String(duplicate._id) !== String(user._id)) {
        patch.username = await buildUniqueUsername(ctx, user.username);
      }
    }
    const profileSeed = (patch.username as string | undefined) || user.username || authUser.name || user.email?.split("@")[0] || String(user._id);
    if (!user.avatar) patch.avatar = authUser.image || buildDefaultAvatar(profileSeed);
    if (isBrokenLegacyBanner(user.banner)) patch.banner = buildDefaultBanner(profileSeed);
    if (user.isPro === undefined) patch.isPro = false;
    if (!user.stats) patch.stats = DEFAULT_STATS;
    if (!user.friends) patch.friends = [];
    if (!user.preferredLanguage) patch.preferredLanguage = DEFAULT_PREFERRED_LANGUAGE;
    if (user.isVerified === undefined) {
      patch.isVerified = Boolean(authUser.emailVerificationTime);
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
      return await ctx.db.get(userId);
    }

    return user;
  },
});
