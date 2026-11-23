/* global Netlify */
// Portail d'accès : voir netlify/gate-core.js. Variable à définir dans Netlify : GATE_SECRET.
import { createGate } from "../gate-core.js";

const gate = createGate({
  env: (k) => Netlify.env.get(k),
  supabaseUrl: "https://winfcuvshinsxielsnln.supabase.co",
  supabaseKey: "sb_publishable_DAHanJxjvlh61GukxXfXUQ_NvVomXGf", // clé publique « publishable » (la même que dans le site)
});

export default (request, context) => gate(request, context);
export const config = { path: "/*" };
