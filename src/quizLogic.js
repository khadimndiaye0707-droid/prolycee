// ── Logique des quiz BTP (sans interface) : formats, correction, import JSON ──
export const CLASSES = { seconde: "🏛️ Seconde", premiere: "📐 1ère TBAA", terminale: "🏗️ Terminale TBAA" };
export const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
export const LETTRES = ["A", "B", "C", "D"];
export const TYPES = { qcm: "QCM", zone: "Clic sur le plan", num: "Valeur numérique" };

// ════════════════════════════════════════════════════════════════
//  Format des questions
//  { type:"qcm"|"zone"|"num", q, answers[], correct(0-3), time, explication,
//    media:{kind:"image"|"model", url}, zone:{x,y,w,h}, value, tol, unit, donnees:[{label,valeur}] }
// ════════════════════════════════════════════════════════════════
export function emptyQuestion(type = "qcm") {
  return { type, q: "", answers: ["", "", "", ""], correct: 0, time: 30, explication: "", media: null, zone: null, value: "", tol: 0, unit: "", donnees: [] };
}

// Spécification de la bonne réponse (envoyée au serveur au moment de la correction seulement)
export function answerSpec(q) {
  const base = q.explication ? { explication: q.explication } : {};
  if (q.type === "zone") return { type: "zone", ...q.zone, ...base };
  if (q.type === "num") return { type: "num", value: Number(q.value), tol: Number(q.tol) || 0, unit: q.unit || "", ...base };
  return { type: "qcm", correct: q.correct, ...base };
}

// Version de la question envoyée aux élèves : jamais la bonne réponse
export function publicQuestion(q) {
  const p = { type: q.type || "qcm", q: q.q, time: q.time || 30 };
  if (p.type === "qcm") p.answers = q.answers;
  if (p.type === "num" && q.unit) p.unit = q.unit;
  if (q.media) p.media = q.media;
  if (q.donnees?.length) p.donnees = q.donnees;
  return p;
}

export function isCorrectSolo(q, a) {
  if (!a) return false;
  if (q.type === "zone") { const z = q.zone; return !!z && a.x >= z.x && a.x <= z.x + z.w && a.y >= z.y && a.y <= z.y + z.h; }
  if (q.type === "num") return Number.isFinite(a.value) && Math.abs(a.value - Number(q.value)) <= (Number(q.tol) || 0);
  return a.choice === q.correct;
}

// Contrôle d'une question avant enregistrement ; renvoie la liste des problèmes
export function validateQuestion(q) {
  const e = [];
  const type = q.type || "qcm";
  if (!q.q.trim()) e.push("énoncé vide");
  if (type === "qcm") {
    const filled = q.answers.filter((a) => a.trim()).length;
    if (filled < 2) e.push("au moins 2 réponses");
    if (!q.answers[q.correct]?.trim()) e.push("la bonne réponse est vide");
  }
  if (type === "zone") {
    if (q.media?.kind !== "image") e.push("une image de plan est nécessaire");
    else if (!q.zone) e.push("la zone correcte n'est pas dessinée");
  }
  if (type === "num" && (q.value === "" || !Number.isFinite(Number(q.value)))) e.push("valeur attendue manquante");
  return e;
}

// ── Import JSON (ChatGPT ou export ProLycée) ─────────────────────
export function normalizeQuestion(raw) {
  const errors = [];
  const type = raw.type === "zone" || raw.type === "num" ? raw.type : "qcm";
  const base = emptyQuestion(type);
  base.q = String(raw.question ?? raw.q ?? "").trim();
  if (!base.q) errors.push("énoncé manquant");
  const t = Number(raw.temps ?? raw.time ?? 30);
  base.time = Number.isFinite(t) ? Math.min(120, Math.max(10, Math.round(t))) : 30;
  base.explication = String(raw.explication ?? "").trim();
  const img = raw.image ?? raw.media?.url;
  if (raw.media && (raw.media.kind === "image" || raw.media.kind === "model") && raw.media.url) base.media = { kind: raw.media.kind, url: String(raw.media.url) };
  else if (img) base.media = { kind: "image", url: String(img) };
  if (Array.isArray(raw.donnees)) base.donnees = raw.donnees.filter((d) => d && d.label).map((d) => ({ label: String(d.label), valeur: String(d.valeur ?? "") }));

  if (type === "qcm") {
    const answers = (raw.reponses ?? raw.answers ?? []).map((a) => String(a).trim());
    if (answers.length < 2 || answers.length > 4) errors.push("il faut 2 à 4 réponses");
    while (answers.length < 4) answers.push("");
    base.answers = answers.slice(0, 4);
    let c = raw.bonne_reponse;
    if (c !== undefined) {
      if (typeof c === "string" && /^[A-D]/i.test(c.trim())) c = "ABCD".indexOf(c.trim().charAt(0).toUpperCase());
      else if (Number.isInteger(Number(c)) && Number(c) >= 1 && Number(c) <= 4) c = Number(c) - 1;
      else c = -1;
    } else c = Number.isInteger(raw.correct) ? raw.correct : -1;
    if (c < 0 || c > 3 || !base.answers[c]) errors.push("bonne réponse invalide (attendu : A, B, C ou D)");
    base.correct = Math.max(0, c);
  } else if (type === "zone") {
    if (raw.zone && ["x", "y", "w", "h"].every((k) => Number.isFinite(Number(raw.zone[k])))) base.zone = { x: +raw.zone.x, y: +raw.zone.y, w: +raw.zone.w, h: +raw.zone.h };
    if (!base.media) errors.push("image du plan manquante");
  } else {
    base.value = raw.valeur ?? raw.value;
    if (!Number.isFinite(Number(base.value)) || base.value === "" || base.value === null) errors.push("valeur attendue manquante");
    base.tol = Number(raw.tolerance ?? raw.tol ?? 0) || 0;
    base.unit = String(raw.unite ?? raw.unit ?? "");
  }
  return { question: base, errors };
}

export function parseQuizJson(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const a = Math.min(...["{", "["].map((c) => (t.indexOf(c) < 0 ? Infinity : t.indexOf(c))));
  const b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (!Number.isFinite(a) || b < a) return { error: "Aucun JSON trouvé dans le texte collé." };
  let obj;
  try { obj = JSON.parse(t.slice(a, b + 1)); } catch (e) { return { error: `JSON invalide : ${e.message}` }; }
  const list = Array.isArray(obj) ? obj : obj.questions;
  if (!Array.isArray(list) || list.length === 0) return { error: "Aucune question trouvée (clé « questions » attendue)." };
  const questions = []; const problems = [];
  list.forEach((raw, i) => {
    const { question, errors } = normalizeQuestion(raw || {});
    if (errors.length) problems.push({ n: i + 1, msg: errors.join(", ") }); else questions.push(question);
  });
  const classe = ["seconde", "premiere", "terminale"].includes(obj.classe) ? obj.classe : "terminale";
  return { quiz: { title: String(obj.titre ?? obj.title ?? "Quiz importé"), filiere: classe, theme: obj.theme ? String(obj.theme) : "", questions }, problems };
}

