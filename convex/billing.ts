import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const PRO_AMOUNT_CENTS = 400;
const PRO_CURRENCY = "USD";

export const requestProUpgrade = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.isPro) return { status: "already_pro" as const };

    const now = Date.now();
    const requestId = await ctx.db.insert("proUpgrades", {
      userId,
      provider: "manual",
      status: "pending",
      amountCents: PRO_AMOUNT_CENTS,
      currency: PRO_CURRENCY,
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: "pending" as const,
      requestId,
      amountCents: PRO_AMOUNT_CENTS,
      currency: PRO_CURRENCY,
    };
  },
});

export const myBillingStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const latest = await ctx.db
      .query("proUpgrades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return {
      isPro: Boolean(user?.isPro),
      latestUpgrade: latest || null,
    };
  },
});

export const markUpgradePaid = internalMutation({
  args: {
    userId: v.id("users"),
    paymentRef: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingPending = await ctx.db
      .query("proUpgrades")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingPending) {
      await ctx.db.patch(existingPending._id, {
        status: "paid",
        paymentRef: args.paymentRef,
        provider: args.provider,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("proUpgrades", {
        userId: args.userId,
        provider: args.provider,
        status: "paid",
        amountCents: PRO_AMOUNT_CENTS,
        currency: PRO_CURRENCY,
        paymentRef: args.paymentRef,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.userId, { isPro: true });
  },
});
