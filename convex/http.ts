import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { webhook as billingWebhook } from "./billingHttp";
import { attachmentScanWebhook } from "./securityHttp";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({
  path: "/billing/webhook",
  method: "POST",
  handler: billingWebhook,
});
http.route({
  path: "/security/attachment-scan",
  method: "POST",
  handler: attachmentScanWebhook,
});

export default http;
