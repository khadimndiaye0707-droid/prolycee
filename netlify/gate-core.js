// ── Portail ProLycée : le site entier est fermé tant qu'aucun code valide n'a été saisi ──
// Tourne sur Netlify AVANT toute page, image ou script : sans cookie valide, le visiteur ne reçoit
// que l'écran de connexion. Les codes sont vérifiés par Supabase (fonction gate_login), jamais ici.
// Le cookie est signé (HMAC) avec GATE_SECRET et contient l'empreinte du code utilisé : quand le prof
// change un code, l'empreinte ne correspond plus et tous les anciens cookies deviennent invalides.
import { loginPage, notConfiguredPage } from "./gate-page.js";

export const COOKIE = "pl_gate";
const MAX_AGE = 60 * 60 * 24 * 14;          // 14 jours
const VERSIONS_TTL = 15_000;                // on redemande les empreintes à Supabase toutes les 15 s
const VERSIONS_STALE_MAX = 10 * 60_000;     // si Supabase ne répond pas : 10 min de tolérance, puis fermé

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(`pl-cookie|${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function signToken(secret, role, fp, exp) {
  const body = b64u(enc.encode(JSON.stringify({ r: role, f: fp, e: exp })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}
export async function readToken(secret, token, nowSec) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (!["prof", "eleve"].includes(p.r) || typeof p.f !== "string" || !(p.e > nowSec)) return null;
    return p;
  } catch { return null; }
}

const cookieOf = (req, name) => {
  const m = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(name + "="));
  return m ? m.slice(name.length + 1) : "";
};
const baseHeaders = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-robots-tag": "noindex, nofollow" };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { ...baseHeaders, "content-type": "application/json; charset=utf-8", ...extra } });
const html = (body, status = 200) => new Response(body, { status, headers: { ...baseHeaders, "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
const setCookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

export function createGate({ env, fetchFn = fetch, now = () => Date.now(), supabaseUrl, supabaseKey }) {
  let versions = null, versionsAt = 0;

  const rpc = async (fn, args) => {
    const r = await fetchFn(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: supabaseKey, authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify(args),
    });
    if (!r.ok) throw new Error(`rpc ${fn} ${r.status}`);
    return r.json();
  };

  async function currentVersions(secret) {
    if (versions && now() - versionsAt < VERSIONS_TTL) return versions;
    try {
      const v = await rpc("gate_versions", { p_key: secret });
      if (v && typeof v === "object") { versions = v; versionsAt = now(); return v; }
    } catch { /* on retombe sur la dernière valeur connue, bornée dans le temps */ }
    return versions && now() - versionsAt < VERSIONS_STALE_MAX ? versions : null;
  }

  async function allowed(request, secret) {
    const p = await readToken(secret, cookieOf(request, COOKIE), Math.floor(now() / 1000));
    if (!p) return false;
    const v = await currentVersions(secret);
    return !!(v && v[p.r] && v[p.r] === p.f);        // empreinte actuelle du code : sinon accès révoqué
  }

  return async function handle(request, context) {
    const secret = env("GATE_SECRET");
    if (!secret || secret.length < 16) return html(notConfiguredPage(), 503);
    const url = new URL(request.url);

    if (url.pathname === "/_gate/login" && request.method === "POST") {
      let body; try { body = await request.json(); } catch { return json({ ok: false }, 400); }
      const role = body?.role === "prof" ? "prof" : "eleve";
      const code = String(body?.code ?? "").slice(0, 200);
      if (!code.trim()) return json({ ok: false });
      let r;
      try { r = await rpc("gate_login", { p_key: secret, p_role: role, p_code: code, p_client: context?.ip || request.headers.get("x-nf-client-connection-ip") || "" }); }
      catch { return json({ ok: false, error: "unavailable" }, 502); }
      if (!r?.ok) return json({ ok: false, locked: !!r?.locked });
      const token = await signToken(secret, role, r.fp, Math.floor(now() / 1000) + MAX_AGE);
      return json({ ok: true, role }, 200, { "set-cookie": setCookie(token, MAX_AGE) });
    }
    if (url.pathname === "/_gate/logout") return json({ ok: true }, 200, { "set-cookie": setCookie("", 0) });

    if (await allowed(request, secret)) return context.next();

    // Pas de cookie valide : seulement l'écran de connexion, rien d'autre.
    const wantsPage = request.method === "GET" && (request.headers.get("accept") || "").includes("text/html");
    if (wantsPage) return html(loginPage(), 200);
    return new Response("Accès réservé : connecte-toi sur la page d'accueil.", { status: 401, headers: { ...baseHeaders, "content-type": "text/plain; charset=utf-8" } });
  };
}
