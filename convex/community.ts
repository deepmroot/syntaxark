import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getPosts = query({
  handler: async (ctx) => {
    return await ctx.db.query("posts").order("desc").take(50);
  },
});

export const createPost = mutation({
  args: {
    authorId: v.id("users"),
    authorName: v.string(),
    authorAvatar: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentType: v.optional(v.string()),
    codeSnippet: v.optional(v.string()),
    language: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let attachmentUrl: string | undefined = undefined;
    if (args.attachmentStorageId) {
      attachmentUrl = (await ctx.storage.getUrl(args.attachmentStorageId)) ?? undefined;
    }
    await ctx.db.insert("posts", {
      ...args,
      attachmentUrl,
      likes: 0,
      timestamp: Date.now(),
    });
  },
});

export const likePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (post) {
      await ctx.db.patch(args.postId, { likes: post.likes + 1 });
    }
  },
});
