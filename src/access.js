// ── Accès fermé : session Supabase + autorisation par code (vérifiée côté serveur) ──
// Le portail Netlify (netlify/gate-core.js) n'ouvre le site qu'avec un code valide. Le code saisi sur
// l'écran de connexion est transmis une seule fois à l'application (sessionStorage « pl_boot ») pour
// créer l'autorisation de cet appareil dans Supabase (fonction redeem_code), puis effacé.
import { supabase } from "./supabase";

export const SECRET_KEY = "prolycee_code_prof";   // même clé que hooks.js
const BOOT_KEY = "pl_boot";

async function ensureSession(fresh = false) {
  if (fresh) await supabase.auth.signOut();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(/anonymous/i.test(error.message) ? "La connexion anonyme n'est pas activée dans Supabase (Authentication → Sign In / Providers)." : error.message);
  return data.session;
}

export async function gateLogout() {
  try { await fetch("/_gate/logout", { method: "POST" }); } catch { /* hors ligne : le cookie expirera */ }
}

// Déconnexion complète : droits retirés côté serveur, cookie du portail effacé, retour à l'écran de connexion.
export async function leave() {
  try { await supabase.rpc("sign_out_access"); } catch { /* ignoré */ }
  try { await supabase.auth.signOut(); } catch { /* ignoré */ }
  localStorage.removeItem(SECRET_KEY);
  sessionStorage.removeItem(BOOT_KEY);
  await gateLogout();
  window.location.assign("/");
}

let bootPromise = null;
export function bootAccess() {
  if (!bootPromise) bootPromise = doBoot();
  return bootPromise;
}

async function doBoot() {
  let boot = null;
  try { boot = JSON.parse(sessionStorage.getItem(BOOT_KEY) || "null"); } catch { /* ignoré */ }
  sessionStorage.removeItem(BOOT_KEY);
  await ensureSession();
  if (boot?.code && (boot.role === "prof" || boot.role === "eleve")) {
    const { data, error } = await supabase.rpc("redeem_code", { p_code: boot.code, p_role: boot.role });
    if (error || !data?.ok) return { state: "denied", locked: !!data?.locked };
    if (boot.role === "prof") localStorage.setItem(SECRET_KEY, String(boot.code).trim());
  }
  let res = await supabase.rpc("my_access");
  if (res.error && /jwt|token|user/i.test(res.error.message)) {      // ancienne session invalide (compte supprimé…)
    await ensureSession(true);
    res = await supabase.rpc("my_access");
  }
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return { state: "denied" };
  return { state: "ok", access: res.data };
}
