const convexSiteUrlRaw = process.env.SMOKE_CONVEX_SITE_URL;
const convexSiteUrl = convexSiteUrlRaw?.trim().replace(/\/+$/, "");

if (!convexSiteUrl) {
  console.log("SKIP: set SMOKE_CONVEX_SITE_URL to run production auth smoke checks.");
  process.exit(0);
}

const checks = [];

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

checks.push(async () => {
  const url = `${convexSiteUrl}/.well-known/openid-configuration`;
  const res = await fetchWithTimeout(url);
  expect(res.ok, `OIDC config not reachable: ${url} -> HTTP ${res.status}`);
  const data = await res.json();
  expect(typeof data.issuer === "string" && data.issuer.length > 0, "OIDC issuer missing");
  console.log(`PASS: OIDC config reachable (${data.issuer})`);
});

const providerChecks = [
  { id: "google", expectedHost: "accounts.google.com" },
  { id: "github", expectedHost: "github.com" },
];

for (const provider of providerChecks) {
  checks.push(async () => {
    const url = `${convexSiteUrl}/api/auth/signin/${provider.id}`;
    const res = await fetchWithTimeout(url, { redirect: "manual" });
    expect(
      res.status >= 300 && res.status < 400,
      `Expected redirect from ${url}, got HTTP ${res.status}`
    );
    const location = res.headers.get("location") || "";
    expect(location.length > 0, `Missing redirect location for ${provider.id}`);
    expect(
      location.includes(provider.expectedHost),
      `Unexpected ${provider.id} redirect host: ${location}`
    );
    console.log(`PASS: ${provider.id} OAuth redirect looks valid`);
  });
}

let failures = 0;
for (const check of checks) {
  try {
    await check();
  } catch (error) {
    failures += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${message}`);
  }
}

if (failures > 0) {
  console.error(`\nProduction auth smoke checks failed: ${failures}`);
  process.exit(1);
}

console.log("\nProduction auth smoke checks passed");
