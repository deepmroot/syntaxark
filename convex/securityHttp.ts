import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const attachmentScanWebhook = httpAction(async (ctx, request) => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const secret = env?.ATTACHMENT_SCAN_WEBHOOK_SECRET;
  if (!secret) return new Response("Missing ATTACHMENT_SCAN_WEBHOOK_SECRET", { status: 500 });
  const provided = request.headers.get("x-attachment-scan-secret");
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response("Invalid JSON", { status: 400 });
  const storageId = body.storageId;
  const status = body.status;
  if (!storageId || (status !== "clean" && status !== "blocked")) {
    return new Response("Missing or invalid storageId/status", { status: 400 });
  }

  await ctx.runMutation(internal.chat.markAttachmentScanResult, {
    storageId,
    status,
    scanner: typeof body.scanner === "string" ? body.scanner : undefined,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
