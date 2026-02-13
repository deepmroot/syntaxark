import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const webhook = httpAction(async (ctx, request) => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const secret = env?.BILLING_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Missing BILLING_WEBHOOK_SECRET", { status: 500 });
  }

  const provided = request.headers.get("x-billing-webhook-secret");
  if (provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response("Invalid JSON", { status: 400 });
  }

  const status = body.status;
  if (status !== "paid") {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }

  const userId = body.userId;
  const paymentRef = body.paymentRef;
  const provider = body.provider ?? "manual";
  if (!userId || !paymentRef) {
    return new Response("Missing userId/paymentRef", { status: 400 });
  }

  await ctx.runMutation(internal.billing.markUpgradePaid, {
    userId,
    paymentRef,
    provider,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
