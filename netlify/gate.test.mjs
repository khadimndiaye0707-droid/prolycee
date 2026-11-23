// Tests du portail : node --test netlify/gate.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createGate, signToken, COOKIE } from "./gate-core.js";

const SECRET = "secret-de-test-assez-long-123456";
const mk = (over = {}) => {
  const state = { now: 1_800_000_000_000, versions: { prof: "FP-PROF", eleve: "FP-ELEVE" }, loginResult: { ok: true, fp: "FP-ELEVE" }, down: false, calls: [], ...over };
  const fetchFn = async (url, init) => {
    const fn = url.split("/rpc/")[1]; const args = JSON.parse(init.body); state.calls.push({ fn, args });
    if (state.down) return new Response("boom", { status: 500 });
    if (fn === "gate_versions") return Response.json(args.p_key === SECRET ? state.versions : null);
    if (fn === "gate_login") return Response.json(args.p_key === SECRET ? state.loginResult : { ok: false });
    return new Response("?", { status: 404 });
  };
  const gate = createGate({ env: (k) => (k === "GATE_SECRET" ? state.secret ?? SECRET : undefined), fetchFn, now: () => state.now, supabaseUrl: "https://x.supabase.co", supabaseKey: "anon" });
  const next = { n: 0 }; const ctx = { ip: "203.0.113.7", next: async () => { next.n++; return new Response("CONTENU PROTEGE"); } };
  return { state, gate, ctx, next };
};
const req = (path, { method = "GET", cookie, html = true, body } = {}) => new Request("https://site.test" + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(html ? { accept: "text/html" } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
const cookieFor = async (state, role = "eleve", fp = "FP-ELEVE", exp) => `${COOKIE}=${await signToken(SECRET, role, fp, exp ?? Math.floor(state.now / 1000) + 1000)}`;

test("sans configuration : fermé (503), jamais ouvert", async () => {
  const t = mk({ secret: "" }); const r = await t.gate(req("/"), t.ctx);
  assert.equal(r.status, 503); assert.equal(t.next.n, 0);
});
test("visiteur : page d'accueil = écran de connexion uniquement", async () => {
  const t = mk(); const r = await t.gate(req("/"), t.ctx); const h = await r.text();
  assert.equal(r.status, 200); assert.match(h, /Code de la classe/); assert.doesNotMatch(h, /script src|\.js"/); assert.equal(t.next.n, 0);
});
test("visiteur : lien direct vers une page, un script, une image → 401, aucun contenu", async () => {
  const t = mk();
  for (const p of ["/assets/index-abc.js", "/plans/dg3-plan-r1.webp", "/tug/terrain.webp", "/favicon.svg", "/n-importe-quoi"]) {
    const r = await t.gate(req(p, { html: false }), t.ctx); assert.equal(r.status, 401, p); assert.doesNotMatch(await r.text(), /CONTENU/);
  }
  const r = await t.gate(req("/plans/x", { method: "POST", html: false }), t.ctx); assert.equal(r.status, 401);
  assert.equal(t.next.n, 0);
});
test("lien direct navigateur vers une sous-page → écran de connexion", async () => {
  const t = mk(); const r = await t.gate(req("/quiz/live"), t.ctx);
  assert.match(await r.text(), /Connexion/); assert.equal(t.next.n, 0);
});
test("mauvais code → pas de cookie ; blocage relayé ; Supabase HS → 502 sans cookie", async () => {
  let t = mk({ loginResult: { ok: false } }); let r = await t.gate(req("/_gate/login", { method: "POST", body: { role: "eleve", code: "faux" } }), t.ctx);
  assert.equal((await r.json()).ok, false); assert.equal(r.headers.get("set-cookie"), null);
  t = mk({ loginResult: { ok: false, locked: true } }); r = await t.gate(req("/_gate/login", { method: "POST", body: { role: "eleve", code: "faux" } }), t.ctx);
  assert.equal((await r.json()).locked, true);
  t = mk({ down: true }); r = await t.gate(req("/_gate/login", { method: "POST", body: { role: "eleve", code: "x" } }), t.ctx);
  assert.equal(r.status, 502); assert.equal(r.headers.get("set-cookie"), null);
  t = mk(); r = await t.gate(req("/_gate/login", { method: "POST", body: { role: "eleve", code: "  " } }), t.ctx);
  assert.equal(r.headers.get("set-cookie"), null);
});
test("bon code → cookie HttpOnly/Secure ; IP client et clé serveur transmises ; accès ensuite", async () => {
  const t = mk(); const r = await t.gate(req("/_gate/login", { method: "POST", body: { role: "eleve", code: "Classe-2026" } }), t.ctx);
  const sc = r.headers.get("set-cookie"); assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.match(sc, /SameSite=Lax/);
  const call = t.state.calls.find((c) => c.fn === "gate_login"); assert.equal(call.args.p_client, "203.0.113.7"); assert.equal(call.args.p_key, SECRET);
  const cookie = sc.split(";")[0]; const r2 = await t.gate(req("/assets/app.js", { cookie, html: false }), t.ctx);
  assert.equal(await r2.text(), "CONTENU PROTEGE"); assert.equal(t.next.n, 1);
});
test("cookie falsifié, altéré ou expiré → refusé", async () => {
  const t = mk(); const good = await cookieFor(t.state);
  const forged = `${COOKIE}=${await signToken("autre-secret-0123456789abcdef", "prof", "FP-PROF", Math.floor(t.state.now / 1000) + 999)}`;
  const [b, s] = good.slice(COOKIE.length + 1).split(".");
  const tampered = `${COOKIE}=${Buffer.from(JSON.stringify({ r: "prof", f: "FP-PROF", e: 9e9 })).toString("base64url")}.${s}`;
  const expired = await cookieFor(t.state, "eleve", "FP-ELEVE", Math.floor(t.state.now / 1000) - 1);
  for (const c of [forged, tampered, expired, "pl_gate=n.importe", "pl_gate="]) {
    const r = await t.gate(req("/", { cookie: c, html: false }), t.ctx); assert.equal(r.status, 401, c.slice(0, 20));
  }
  assert.equal(t.next.n, 0); assert.ok(b);
});
test("un cookie élève ne peut pas se faire passer pour prof (empreinte propre à chaque rôle)", async () => {
  const t = mk(); const c = await cookieFor(t.state, "prof", "FP-ELEVE");
  assert.equal((await t.gate(req("/", { cookie: c, html: false }), t.ctx)).status, 401);
});
test("révocation : le prof change le code élève → les anciens cookies tombent (après ≤ 15 s)", async () => {
  const t = mk(); const c = await cookieFor(t.state);
  assert.equal((await t.gate(req("/", { cookie: c }), t.ctx)).status, 200); assert.equal(t.next.n, 1);
  t.state.versions = { prof: "FP-PROF", eleve: "FP-NOUVEAU" };
  t.state.now += 5_000; await t.gate(req("/", { cookie: c }), t.ctx); assert.equal(t.next.n, 2); // cache encore valable
  t.state.now += 11_000; const r = await t.gate(req("/", { cookie: c, html: false }), t.ctx);
  assert.equal(r.status, 401); assert.equal(t.next.n, 2);
  // le prof, lui, garde son accès
  const cp = await cookieFor(t.state, "prof", "FP-PROF"); assert.equal(await (await t.gate(req("/", { cookie: cp }), t.ctx)).text(), "CONTENU PROTEGE");
});
test("code élève absent côté serveur (aucun code défini) → aucun cookie élève valable", async () => {
  const t = mk({ versions: { prof: "FP-PROF", eleve: null } }); const c = await cookieFor(t.state, "eleve", "FP-ELEVE");
  assert.equal((await t.gate(req("/", { cookie: c, html: false }), t.ctx)).status, 401);
});
test("Supabase injoignable : tolérance bornée puis fermeture ; jamais ouvert sans connaissance", async () => {
  let t = mk({ down: true }); let c = await cookieFor(t.state);
  assert.equal((await t.gate(req("/", { cookie: c, html: false }), t.ctx)).status, 401);       // jamais vu les empreintes → fermé
  t = mk(); c = await cookieFor(t.state); await t.gate(req("/", { cookie: c }), t.ctx);          // empreintes connues
  t.state.down = true; t.state.now += 60_000; assert.equal((await t.gate(req("/", { cookie: c }), t.ctx)).status, 200); // panne brève : on tolère
  t.state.now += 11 * 60_000; assert.equal((await t.gate(req("/", { cookie: c, html: false }), t.ctx)).status, 401);   // panne longue : fermé
});
test("déconnexion : efface le cookie", async () => {
  const t = mk(); const r = await t.gate(req("/_gate/logout", { method: "POST" }), t.ctx);
  assert.match(r.headers.get("set-cookie"), /Max-Age=0/);
});
