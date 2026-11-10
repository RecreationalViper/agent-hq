// Cloudflare AI Gateway: every agent AI call goes through one free, always-on gateway in our Cloudflare
// account (dashboard: Cloudflare > AI > AI Gateway > "agent-hq"): one place for usage, errors, caching and
// rate limits across Gemini, Groq and OpenRouter. NVIDIA isn't a gateway provider, so it stays direct.
// Safe by design: if the gateway itself fails (not the AI provider), the call goes straight to the provider,
// and the gateway is skipped for the rest of that run. Turn off with AI_GATEWAY=off.
const ACCOUNT = () => process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
export const GATEWAY_ID = process.env.AI_GATEWAY && process.env.AI_GATEWAY !== "off" ? process.env.AI_GATEWAY : "agent-hq";
let disabled = process.env.AI_GATEWAY === "off";
export const gatewayOn = () => !disabled && Boolean(ACCOUNT());
const GW = () => `https://gateway.ai.cloudflare.com/v1/${ACCOUNT()}/${GATEWAY_ID}`;

// Direct provider address -> gateway address
const ROUTES = [
  [/^https:\/\/generativelanguage\.googleapis\.com\/v1beta/, () => `${GW()}/google-ai-studio/v1beta`],
  [/^https:\/\/api\.groq\.com\/openai\/v1/, () => `${GW()}/groq`],
  [/^https:\/\/openrouter\.ai\/api\/v1/, () => `${GW()}/openrouter`]
  // Workers AI stays direct: it's Cloudflare's own (already in the Cloudflare dashboard) and refused gateway auth.
];
export function gatewayUrl(url) {
  if (!gatewayOn()) return null;
  for (const [re, to] of ROUTES) if (re.test(url)) return url.replace(re, to());
  return null;
}

// The gateway is authenticated (Cloudflare's default): our Cloudflare token goes in cf-aig-authorization.
function withGatewayAuth(headers = {}) {
  const tok = process.env.CF_AIG_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();
  return tok ? { ...headers, "cf-aig-authorization": `Bearer ${tok}` } : headers;
}
export { withGatewayAuth };

// Drop-in for fetch(): tries the gateway, falls back to the direct address on gateway problems.
export async function gwFetch(url, init = {}) {
  const via = gatewayUrl(url);
  if (!via) return fetch(url, init);
  try {
    const res = await fetch(via, { ...init, headers: withGatewayAuth(init.headers), signal: AbortSignal.timeout(150000) });
    if (res.ok) return res;
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    // Cloudflare's own error envelope = a gateway problem (missing gateway, bad route...). Provider errors pass through.
    // (AiGatewayError, or the {success:false, errors|error:[...]} envelope)
    const gatewayError = data && (data.name === "AiGatewayError" || data.success === false && (Array.isArray(data.errors) || Array.isArray(data.error))) || [502, 504].includes(res.status) && !data;
    if (gatewayError) throw new Error(`gateway HTTP ${res.status}: ${(data?.errors?.[0]?.message || text).slice(0, 120)}`);
    return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch (e) {
    if (!disabled) console.log(`  AI Gateway skipped this run (${e.message}); calling providers directly`);
    disabled = true;
    return fetch(url, init);
  }
}

// Creates the gateway once (idempotent). Needs CLOUDFLARE_API_TOKEN with AI Gateway edit permission.
export async function ensureGateway() {
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT()}/ai-gateway/gateways`;
  const h = { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };
  const got = await fetch(`${base}/${GATEWAY_ID}`, { headers: h });
  if (got.ok) return { created: false, gateway: (await got.json()).result };
  const res = await fetch(base, { method: "POST", headers: h, body: JSON.stringify({
    id: GATEWAY_ID, cache_ttl: 3600, cache_invalidate_on_update: true, collect_logs: true,
    rate_limiting_interval: 60, rate_limiting_limit: 200, rate_limiting_technique: "sliding"
  }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`create gateway HTTP ${res.status}: ${j.errors?.[0]?.message || JSON.stringify(j).slice(0, 200)}`);
  return { created: true, gateway: j.result };
}
