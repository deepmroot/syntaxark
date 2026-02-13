import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

type Difficulty = "Easy" | "Medium" | "Hard";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 6000;
const MAX_TEST_CASES = 25;
const MAX_TEST_JSON = 4000;
const MAX_TAGS = 12;
const MAX_TAG_LEN = 32;
const MAX_LANGUAGES = 20;
const MAX_STARTER_PER_LANG = 12000;

const FUNCTION_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

const SUPPORTED_LANGS = new Set([
  "js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "rs",
  "go", "cs", "php", "rb", "swift", "kt", "lua", "r", "sh",
]);

const SECURITY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<script\b/i, reason: "Contains <script> tag" },
  { pattern: /javascript:/i, reason: "Contains javascript: URL" },
  { pattern: /onerror\s*=/i, reason: "Contains inline event handler" },
  { pattern: /child_process|spawn\(|exec\(/i, reason: "Contains process execution primitive" },
  { pattern: /\bprocess\.env\b/i, reason: "Contains environment variable access" },
  { pattern: /\bimport\s+os\b|\bos\.system\(/i, reason: "Contains OS command execution pattern" },
  { pattern: /\bsystem\(/i, reason: "Contains system() invocation" },
];

const normalizeTag = (tag: string) =>
  tag.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, MAX_TAG_LEN);

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const parseJson = (value: string): { ok: true; data: unknown } | { ok: false } => {
  try {
    return { ok: true, data: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
};

const deepSize = (obj: unknown): number => JSON.stringify(obj).length;

const securityScan = (title: string, description: string, starterCodeByLanguage: Record<string, string>): string[] => {
  const flags: string[] = [];
  const allText = `${title}\n${description}`;
  for (const entry of SECURITY_PATTERNS) {
    if (entry.pattern.test(allText)) flags.push(entry.reason);
  }
  for (const [lang, starter] of Object.entries(starterCodeByLanguage)) {
    for (const entry of SECURITY_PATTERNS) {
      if (entry.pattern.test(starter)) flags.push(`${entry.reason} in starterCode(${lang})`);
    }
  }
  return [...new Set(flags)];
};

type SubmissionPayload = {
  title: string;
  difficulty: Difficulty;
  description: string;
  functionName: string;
  starterCodeByLanguage: Record<string, string>;
  testCases: Array<{ name: string; inputJson: string; expectedJson: string }>;
  tags?: string[];
  companyTags?: string[];
  demandScore?: number;
};

const validatePayload = (payload: SubmissionPayload) => {
  const errors: string[] = [];

  const title = payload.title.trim();
  if (!title) errors.push("Title is required");
  if (title.length > MAX_TITLE) errors.push(`Title must be <= ${MAX_TITLE} chars`);

  const description = payload.description.trim();
  if (!description) errors.push("Description is required");
  if (description.length > MAX_DESCRIPTION) errors.push(`Description must be <= ${MAX_DESCRIPTION} chars`);

  if (!FUNCTION_NAME_RE.test(payload.functionName.trim())) {
    errors.push("Function name must match [A-Za-z_][A-Za-z0-9_]{0,63}");
  }

  const langEntries = Object.entries(payload.starterCodeByLanguage || {});
  if (langEntries.length === 0) errors.push("At least one starter code language is required");
  if (langEntries.length > MAX_LANGUAGES) errors.push(`Too many starter code languages (max ${MAX_LANGUAGES})`);
  for (const [lang, code] of langEntries) {
    if (!SUPPORTED_LANGS.has(lang)) errors.push(`Unsupported language key: ${lang}`);
    if (!code.trim()) errors.push(`Starter code cannot be empty for ${lang}`);
    if (code.length > MAX_STARTER_PER_LANG) errors.push(`Starter code too large for ${lang}`);
  }

  if (!Array.isArray(payload.testCases) || payload.testCases.length === 0) {
    errors.push("At least one test case is required");
  } else if (payload.testCases.length > MAX_TEST_CASES) {
    errors.push(`Too many test cases (max ${MAX_TEST_CASES})`);
  } else {
    payload.testCases.forEach((tc, idx) => {
      const n = idx + 1;
      if (!tc.name?.trim()) errors.push(`Test case ${n}: name is required`);
      if ((tc.inputJson || "").length > MAX_TEST_JSON) errors.push(`Test case ${n}: inputJson too large`);
      if ((tc.expectedJson || "").length > MAX_TEST_JSON) errors.push(`Test case ${n}: expectedJson too large`);

      const parsedInput = parseJson(tc.inputJson);
      if (!parsedInput.ok) {
        errors.push(`Test case ${n}: inputJson must be valid JSON`);
      } else if (!Array.isArray(parsedInput.data)) {
        errors.push(`Test case ${n}: inputJson must be a JSON array`);
      } else if (deepSize(parsedInput.data) > MAX_TEST_JSON) {
        errors.push(`Test case ${n}: inputJson payload too large`);
      }

      const parsedExpected = parseJson(tc.expectedJson);
      if (!parsedExpected.ok) errors.push(`Test case ${n}: expectedJson must be valid JSON`);
      else if (deepSize(parsedExpected.data) > MAX_TEST_JSON) errors.push(`Test case ${n}: expectedJson payload too large`);
    });
  }

  const tags = (payload.tags || []).map(normalizeTag).filter(Boolean);
  const companyTags = (payload.companyTags || []).map(normalizeTag).filter(Boolean);
  if (tags.length > MAX_TAGS) errors.push(`Too many tags (max ${MAX_TAGS})`);
  if (companyTags.length > MAX_TAGS) errors.push(`Too many company tags (max ${MAX_TAGS})`);

  const demandScore = Math.max(0, Math.min(100, Math.floor(payload.demandScore ?? 50)));

  return {
    errors,
    normalized: {
      title,
      slug: slugify(title),
      difficulty: payload.difficulty,
      description,
      functionName: payload.functionName.trim(),
      starterCodeByLanguage: payload.starterCodeByLanguage,
      testCases: payload.testCases,
      tags,
      companyTags,
      demandScore,
    },
  };
};

const isModerator = async (ctx: any, reviewerId: Id<"users">): Promise<boolean> => {
  const reviewer = await ctx.db.get(reviewerId);
  return Boolean(reviewer && (reviewer.isPro || reviewer.isVerified));
};

const ACTIVE_WINDOW_MS = 10 * 60 * 1000;
const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  Easy: 25,
  Medium: 50,
  Hard: 80,
};

const dayKeyUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const previousDayKeyUtc = (dayKey: string) => {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const rankFromXp = (xp: number) => {
  if (xp >= 2500) return "Legend";
  if (xp >= 1500) return "Master";
  if (xp >= 900) return "Expert";
  if (xp >= 450) return "Apprentice";
  return "Cadet";
};

export const touchActivity = mutation({
  args: {
    challengeKey: v.string(),
    event: v.union(v.literal("open"), v.literal("try"), v.literal("accept")),
  },
  handler: async (ctx, args) => {
    const authed = await getAuthUserId(ctx);
    if (!authed) return { ok: false, reason: "unauthorized" as const };
    const userId = authed as Id<"users">;
    const now = Date.now();

    const existing = await ctx.db
      .query("challengeActivity")
      .withIndex("by_user_challenge", (q) => q.eq("userId", userId).eq("challengeKey", args.challengeKey))
      .first();

    if (!existing) {
      await ctx.db.insert("challengeActivity", {
        challengeKey: args.challengeKey,
        userId,
        tries: args.event === "try" ? 1 : 0,
        accepted: args.event === "accept",
        lastActiveAt: now,
      });
      return { ok: true };
    }

    await ctx.db.patch(existing._id, {
      tries: args.event === "try" ? existing.tries + 1 : existing.tries,
      accepted: args.event === "accept" ? true : existing.accepted,
      lastActiveAt: now,
    });
    return { ok: true };
  },
});

export const awardChallengeCompletion = mutation({
  args: {
    challengeKey: v.string(),
    difficulty: v.optional(v.union(v.literal("Easy"), v.literal("Medium"), v.literal("Hard"))),
  },
  handler: async (ctx, args) => {
    const authed = await getAuthUserId(ctx);
    if (!authed) return { ok: false, reason: "unauthorized" as const };
    const userId = authed as Id<"users">;
    const now = Date.now();

    const existing = await ctx.db
      .query("challengeActivity")
      .withIndex("by_user_challenge", (q) => q.eq("userId", userId).eq("challengeKey", args.challengeKey))
      .first();

    const alreadyAccepted = Boolean(existing?.accepted);

    if (!existing) {
      await ctx.db.insert("challengeActivity", {
        challengeKey: args.challengeKey,
        userId,
        tries: 0,
        accepted: true,
        lastActiveAt: now,
      });
    } else {
      await ctx.db.patch(existing._id, {
        accepted: true,
        lastActiveAt: now,
      });
    }

    const user = await ctx.db.get(userId);
    if (!user) return { ok: false, reason: "user_missing" as const };

    // Award XP / solved count only once per challenge.
    if (!alreadyAccepted) {
      const stats = user.stats || { problemsSolved: 0, streak: 0, rank: "Cadet", xp: 100 };
      const difficulty = args.difficulty || "Easy";
      const gainedXp = XP_BY_DIFFICULTY[difficulty];
      const nextXp = (stats.xp || 0) + gainedXp;
      const solved = (stats.problemsSolved || 0) + 1;

      const today = dayKeyUtc(now);
      const previous = user.lastSolvedDay;
      let streak = Math.max(0, Number(stats.streak || 0));
      if (previous !== today) {
        streak = previous && previous === previousDayKeyUtc(today) ? streak + 1 : 1;
      }
      const longestStreak = Math.max(Number(user.longestStreak || 0), streak);

      await ctx.db.patch(userId, {
        stats: {
          problemsSolved: solved,
          streak,
          xp: nextXp,
          rank: rankFromXp(nextXp),
        },
        lastSolvedDay: today,
        longestStreak,
      });

      return {
        ok: true,
        awarded: true,
        gainedXp,
        stats: {
          problemsSolved: solved,
          streak,
          xp: nextXp,
          rank: rankFromXp(nextXp),
        },
      };
    }

    return { ok: true, awarded: false };
  },
});

export const getActivityForKeys = query({
  args: {
    challengeKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const keys = [...new Set(args.challengeKeys.map((k) => k.trim()).filter(Boolean))].slice(0, 600);
    if (keys.length === 0) return {};

    const now = Date.now();
    const out: Record<string, { tried: number; accepted: number; active: number }> = {};
    for (const key of keys) out[key] = { tried: 0, accepted: 0, active: 0 };

    for (const key of keys) {
      const rows = await ctx.db
        .query("challengeActivity")
        .withIndex("by_challenge", (q) => q.eq("challengeKey", key))
        .collect();
      out[key] = {
        tried: rows.reduce((acc, row) => acc + (row.tries > 0 ? 1 : 0), 0),
        accepted: rows.reduce((acc, row) => acc + (row.accepted ? 1 : 0), 0),
        active: rows.reduce((acc, row) => acc + (now - row.lastActiveAt <= ACTIVE_WINDOW_MS ? 1 : 0), 0),
      };
    }

    return out;
  },
});

export const getMyActivityForKeys = query({
  args: {
    challengeKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const authed = await getAuthUserId(ctx);
    if (!authed) return {};
    const userId = authed as Id<"users">;

    const keys = [...new Set(args.challengeKeys.map((k) => k.trim()).filter(Boolean))].slice(0, 600);
    if (keys.length === 0) return {};

    const out: Record<string, { tries: number; accepted: boolean; lastActiveAt: number | null }> = {};
    for (const key of keys) {
      const row = await ctx.db
        .query("challengeActivity")
        .withIndex("by_user_challenge", (q) => q.eq("userId", userId).eq("challengeKey", key))
        .first();
      out[key] = {
        tries: row?.tries ?? 0,
        accepted: Boolean(row?.accepted),
        lastActiveAt: row?.lastActiveAt ?? null,
      };
    }
    return out;
  },
});

export const recordSolutionAttempt = mutation({
  args: {
    challengeKey: v.string(),
    language: v.string(),
    fileName: v.string(),
    code: v.string(),
    passed: v.boolean(),
    totalCases: v.number(),
    passedCases: v.number(),
  },
  handler: async (ctx, args) => {
    const authed = await getAuthUserId(ctx);
    if (!authed) return { ok: false, reason: "unauthorized" as const };
    const userId = authed as Id<"users">;

    const now = Date.now();
    await ctx.db.insert("challengeSolutions", {
      challengeKey: args.challengeKey.trim(),
      userId,
      language: args.language.trim().toLowerCase(),
      fileName: args.fileName.trim(),
      code: args.code,
      passed: args.passed,
      totalCases: Math.max(0, Math.floor(args.totalCases)),
      passedCases: Math.max(0, Math.floor(args.passedCases)),
      submittedAt: now,
    });
    return { ok: true, submittedAt: now };
  },
});

export const listMySolutions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authed = await getAuthUserId(ctx);
    if (!authed) return [];
    const userId = authed as Id<"users">;
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
    return await ctx.db
      .query("challengeSolutions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const listChallenges = query({
  args: {
    difficulty: v.optional(v.union(v.literal("Easy"), v.literal("Medium"), v.literal("Hard"))),
    source: v.optional(v.union(v.literal("seed"), v.literal("user"), v.literal("ai"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 100, 300));
    let docs = await ctx.db
      .query("challenges")
      .withIndex("by_status_difficulty", (q) =>
        q.eq("status", "approved").eq("difficulty", args.difficulty ?? "Easy"),
      )
      .collect();

    if (!args.difficulty) {
      docs = await ctx.db
        .query("challenges")
        .withIndex("by_status_difficulty", (q) => q.eq("status", "approved").eq("difficulty", "Easy"))
        .collect()
        .then(async (easy) => {
          const medium = await ctx.db
            .query("challenges")
            .withIndex("by_status_difficulty", (q) => q.eq("status", "approved").eq("difficulty", "Medium"))
            .collect();
          const hard = await ctx.db
            .query("challenges")
            .withIndex("by_status_difficulty", (q) => q.eq("status", "approved").eq("difficulty", "Hard"))
            .collect();
          return [...easy, ...medium, ...hard];
        });
    }

    if (args.source) docs = docs.filter((d) => d.source === args.source);
    docs.sort((a, b) => b.demandScore - a.demandScore || b.createdAt - a.createdAt);
    return docs.slice(0, limit);
  },
});

export const listPendingSubmissions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 100, 300));
    return await ctx.db
      .query("challengeSubmissions")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending_review"))
      .order("desc")
      .take(limit);
  },
});

export const submitChallenge = mutation({
  args: {
    submittedBy: v.optional(v.id("users")),
    title: v.string(),
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
    tags: v.optional(v.array(v.string())),
    companyTags: v.optional(v.array(v.string())),
    demandScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { errors, normalized } = validatePayload(args);
    const flags = securityScan(normalized.title, normalized.description, normalized.starterCodeByLanguage);

    const existingApproved = await ctx.db
      .query("challenges")
      .withIndex("by_slug", (q) => q.eq("slug", normalized.slug))
      .first();
    if (existingApproved) errors.push("Challenge with this title already exists");

    const existingPending = await ctx.db
      .query("challengeSubmissions")
      .withIndex("by_slug", (q) => q.eq("slug", normalized.slug))
      .first();
    if (existingPending?.status === "pending_review") errors.push("A submission for this title is already pending review");

    const id = await ctx.db.insert("challengeSubmissions", {
      ...normalized,
      source: "user",
      status: "pending_review",
      submittedBy: args.submittedBy,
      reviewedBy: undefined,
      moderationNote: undefined,
      validationErrors: errors,
      securityFlags: flags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      submissionId: id,
      accepted: errors.length === 0 && flags.length === 0,
      validationErrors: errors,
      securityFlags: flags,
    };
  },
});

export const reviewSubmission = mutation({
  args: {
    reviewerId: v.id("users"),
    submissionId: v.id("challengeSubmissions"),
    action: v.union(v.literal("approve"), v.literal("reject"), v.literal("needs_changes")),
    moderationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isModerator(ctx, args.reviewerId))) {
      return { ok: false, error: "Only moderators can review submissions" };
    }

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return { ok: false, error: "Submission not found" };
    if (submission.status !== "pending_review") return { ok: false, error: "Submission already reviewed" };

    if (args.action !== "approve") {
      const status = args.action === "reject" ? "rejected" : "needs_changes";
      await ctx.db.patch(args.submissionId, {
        status,
        reviewedBy: args.reviewerId,
        moderationNote: args.moderationNote,
        updatedAt: Date.now(),
      });
      return { ok: true, status };
    }

    if (submission.validationErrors.length > 0) {
      return { ok: false, error: "Submission has validation errors" };
    }

    const duplicate = await ctx.db
      .query("challenges")
      .withIndex("by_slug", (q) => q.eq("slug", submission.slug))
      .first();
    if (duplicate) return { ok: false, error: "Approved challenge with same slug already exists" };

    const challengeId = await ctx.db.insert("challenges", {
      title: submission.title,
      slug: submission.slug,
      difficulty: submission.difficulty,
      description: submission.description,
      functionName: submission.functionName,
      starterCodeByLanguage: submission.starterCodeByLanguage,
      testCases: submission.testCases,
      tags: submission.tags,
      companyTags: submission.companyTags,
      demandScore: submission.demandScore,
      source: submission.source,
      status: "approved",
      createdBy: submission.submittedBy,
      reviewedBy: args.reviewerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.patch(args.submissionId, {
      status: "approved",
      reviewedBy: args.reviewerId,
      moderationNote: args.moderationNote,
      updatedAt: Date.now(),
    });

    return { ok: true, status: "approved", challengeId };
  },
});

const aiTemplateByTopic: Record<string, {
  title: string;
  description: string;
  functionName: string;
  tags: string[];
  companyTags: string[];
  demandScore: number;
  cases: Array<{ name: string; inputJson: string; expectedJson: string }>;
  starters: Record<string, string>;
}> = {
  "two-pointers": {
    title: "Closest Pair Under Target",
    description:
      "Given a sorted integer array `nums` and integer `target`, return indices `[i, j]` with `i < j` whose sum is the largest value <= target. Return `[-1, -1]` if no valid pair exists.",
    functionName: "closestPairUnderTarget",
    tags: ["arrays", "two-pointers"],
    companyTags: ["meta", "amazon", "google"],
    demandScore: 86,
    cases: [
      { name: "Basic", inputJson: "[[1,2,4,8], 6]", expectedJson: "[0,2]" },
      { name: "No pair", inputJson: "[[7,8,9], 5]", expectedJson: "[-1,-1]" },
      { name: "Exact", inputJson: "[[1,3,5,7], 8]", expectedJson: "[0,3]" },
    ],
    starters: {
      js: "function closestPairUnderTarget(nums, target) {\n  // TODO\n  return [-1, -1];\n}",
      ts: "function closestPairUnderTarget(nums: number[], target: number): [number, number] {\n  // TODO\n  return [-1, -1];\n}",
      py: "def closestPairUnderTarget(nums, target):\n    # TODO\n    return [-1, -1]\n",
      java: "class Main {\n  static int[] closestPairUnderTarget(int[] nums, int target) {\n    // TODO\n    return new int[]{-1, -1};\n  }\n}",
      cs: "using System.Collections.Generic;\nclass Program {\n  public static List<int> closestPairUnderTarget(List<int> nums, int target) {\n    // TODO\n    return new List<int> { -1, -1 };\n  }\n}",
    },
  },
  "graphs": {
    title: "Service Reachability Count",
    description:
      "Given `n` services labeled `0..n-1`, directed edges, and a `start` node, return how many services are reachable from `start` including itself.",
    functionName: "reachableCount",
    tags: ["graphs", "bfs", "dfs"],
    companyTags: ["uber", "netflix", "airbnb"],
    demandScore: 82,
    cases: [
      { name: "Connected", inputJson: "[4, [[0,1],[1,2],[2,3]], 0]", expectedJson: "4" },
      { name: "Partial", inputJson: "[5, [[0,1],[1,2],[3,4]], 3]", expectedJson: "2" },
      { name: "Isolated", inputJson: "[3, [], 1]", expectedJson: "1" },
    ],
    starters: {
      js: "function reachableCount(n, edges, start) {\n  // TODO\n  return 0;\n}",
      ts: "function reachableCount(n: number, edges: number[][], start: number): number {\n  // TODO\n  return 0;\n}",
      py: "def reachableCount(n, edges, start):\n    # TODO\n    return 0\n",
      java: "import java.util.*;\nclass Main {\n  static int reachableCount(int n, int[][] edges, int start) {\n    // TODO\n    return 0;\n  }\n}",
      cs: "class Program {\n  public static int reachableCount(int n, int[][] edges, int start) {\n    // TODO\n    return 0;\n  }\n}",
    },
  },
};

export const generateAiChallenge = mutation({
  args: {
    requestedBy: v.optional(v.id("users")),
    topic: v.string(),
    difficulty: v.union(v.literal("Easy"), v.literal("Medium"), v.literal("Hard")),
    languageHints: v.optional(v.array(v.string())),
    companyFocus: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const key = args.topic.trim().toLowerCase();
    const template = aiTemplateByTopic[key] ?? aiTemplateByTopic["two-pointers"];

    const languageHints = (args.languageHints || [])
      .map((l) => l.trim().toLowerCase())
      .filter((l) => SUPPORTED_LANGS.has(l));
    const chosenLangs = languageHints.length > 0 ? languageHints : Object.keys(template.starters);

    const starterCodeByLanguage: Record<string, string> = {};
    for (const lang of chosenLangs) {
      if (template.starters[lang]) starterCodeByLanguage[lang] = template.starters[lang];
    }
    if (Object.keys(starterCodeByLanguage).length === 0) starterCodeByLanguage.js = template.starters.js;

    const mergedCompanyTags = [
      ...template.companyTags,
      ...((args.companyFocus || []).map(normalizeTag).filter(Boolean)),
    ].slice(0, MAX_TAGS);

    const payload: SubmissionPayload = {
      title: `${template.title} (${args.difficulty})`,
      difficulty: args.difficulty,
      description: template.description,
      functionName: template.functionName,
      starterCodeByLanguage,
      testCases: template.cases,
      tags: template.tags,
      companyTags: mergedCompanyTags,
      demandScore: template.demandScore,
    };

    const { errors, normalized } = validatePayload(payload);
    const flags = securityScan(normalized.title, normalized.description, normalized.starterCodeByLanguage);
    const id = await ctx.db.insert("challengeSubmissions", {
      ...normalized,
      source: "ai",
      status: "pending_review",
      submittedBy: args.requestedBy,
      reviewedBy: undefined,
      moderationNote: "AI-generated draft; requires moderator approval.",
      validationErrors: errors,
      securityFlags: flags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      submissionId: id,
      status: "pending_review" as const,
      validationErrors: errors,
      securityFlags: flags,
    };
  },
});
