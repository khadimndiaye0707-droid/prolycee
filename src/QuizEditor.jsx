// ── Éditeur de questions BTP, import ChatGPT et bibliothèque de quiz sauvegardés ──
import { useState } from "react";
import { COLORS, LETTRES, TYPES, CLASSES, parseQuizJson, validateQuestion } from "./quizLogic";
import { ZoneEditor, Media } from "./QuizParts";
import { uploadMedia, imageToBlob, pdfToBlob, ifcToGlb } from "./media";

const errText = (e) => (e && e.message ? e.message : "Erreur de connexion");

// ════════════════════════════════════════════════════════════════
//  Bibliothèque : connexion par code prof (la logique est dans hooks.js)
// ════════════════════════════════════════════════════════════════
export function LibraryLogin({ lib }) {
  const [v, setV] = useState(lib.secret);
  return <form className="card library-login" onSubmit={(e) => { e.preventDefault(); lib.connect(v); }}>
    <div className="overline">🔒 Bibliothèque de quiz</div>
    <p className="hint">Entre ton code prof pour retrouver et sauvegarder tes quiz (ils ne disparaissent plus au rechargement).</p>
    <div className="btn-row">
      <input type="password" className="field" style={{ maxWidth: 260 }} aria-label="Code prof" placeholder="Code prof" value={v} onChange={(e) => setV(e.target.value)} />
      <button type="submit" className="btn btn-primary" disabled={lib.loading || !v.trim()}>{lib.loading ? "⏳" : "Se connecter"}</button>
    </div>
    {lib.error && <div className="alert" role="alert" style={{ marginTop: "0.6rem" }}>{lib.error}</div>}
  </form>;
}

// ════════════════════════════════════════════════════════════════
//  Import JSON (ChatGPT)
// ════════════════════════════════════════════════════════════════
export function ImportPanel({ onUse, onBack }) {
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  return <div>
    <header className="page-head" data-size="sm">
      <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>← Retour</button>
      <span className="page-icon" aria-hidden="true">📥</span>
      <div className="page-head-text"><h1 className="page-title">Importer depuis ChatGPT</h1></div>
    </header>
    <div className="card card-accent" style={{ "--accent": "#0e7490", marginBottom: "1rem" }}>
      <label className="card-title" htmlFor="imp-json" style={{ display: "block" }}>Colle ici le JSON donné par ChatGPT</label>
      <textarea id="imp-json" className="field" rows={9} placeholder={'{ "titre": "…", "classe": "terminale", "questions": [ … ] }'} value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} />
      <div style={{ marginTop: "0.8rem" }}><button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => setRes(parseQuizJson(text))}>🔍 Vérifier</button></div>
    </div>
    {res?.error && <div className="alert" role="alert">{res.error}</div>}
    {res?.quiz && <>
      <div className="banner" data-tone={res.problems.length ? "neutral" : "ok"} role="status">
        ✅ {res.quiz.questions.length} question{res.quiz.questions.length > 1 ? "s" : ""} valide{res.quiz.questions.length > 1 ? "s" : ""} — « {res.quiz.title} » ({CLASSES[res.quiz.filiere]})
        {res.problems.length > 0 && <ul style={{ margin: "0.4rem 0 0 1.1rem" }}>{res.problems.map((p) => <li key={p.n}>⚠️ Question {p.n} ignorée : {p.msg}</li>)}</ul>}
      </div>
      {res.quiz.questions.slice(0, 3).map((q, i) => <div key={i} className="card" style={{ marginBottom: "0.5rem" }}>
        <b>{i + 1}. {q.q}</b>
        <div className="hint">{q.type === "qcm" ? q.answers.filter(Boolean).map((a, j) => `${LETTRES[j]}. ${a}${j === q.correct ? " ✓" : ""}`).join("  ·  ") : TYPES[q.type]}</div>
      </div>)}
      {res.quiz.questions.length > 3 && <p className="hint">… et {res.quiz.questions.length - 3} autres.</p>}
      <div className="btn-row" style={{ marginTop: "1rem" }}>
        <button type="button" className="btn btn-primary" disabled={res.quiz.questions.length === 0} onClick={() => onUse(res.quiz)}>✏️ Relire et modifier avant de sauvegarder</button>
      </div>
    </>}
  </div>;
}

// ════════════════════════════════════════════════════════════════
//  Éditeur d'une question
// ════════════════════════════════════════════════════════════════
export function QuestionEditor({ q, index, onChange, onRemove, canRemove }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [bim, setBim] = useState((q.donnees || []).map((d) => `${d.label} : ${d.valeur}`).join("\n"));
  const set = (patch) => onChange({ ...q, ...patch });
  const type = q.type || "qcm";

  const handleFile = async (file, kind) => {
    if (!file) return;
    setErr("");
    try {
      let blob, name = file.name, ct, mk = "image";
      const lower = file.name.toLowerCase();
      if (kind === "model") {
        mk = "model"; ct = "model/gltf-binary";
        if (lower.endsWith(".ifc")) { setBusy("Conversion IFC → 3D… 0 %"); blob = await ifcToGlb(file, (p) => setBusy(`Conversion IFC → 3D… ${Math.round(p * 100)} %`)); name = name.replace(/\.ifc$/i, ".glb"); }
        else if (lower.endsWith(".glb")) blob = file;
        else throw new Error("Format attendu : .ifc ou .glb");
      } else if (lower.endsWith(".pdf")) {
        setBusy("Lecture du PDF…"); blob = await pdfToBlob(file, page); name = name.replace(/\.pdf$/i, ".webp"); ct = "image/webp";
      } else { setBusy("Optimisation de l'image…"); blob = await imageToBlob(file); name = name.replace(/\.\w+$/, ".webp"); ct = "image/webp"; }
      if (blob.size > 25 * 1024 * 1024) throw new Error("Fichier trop lourd (25 Mo maximum).");
      setBusy("Envoi…");
      const url = await uploadMedia(blob, name, ct);
      set({ media: { kind: mk, url }, zone: mk === "image" ? q.zone : null, type: type === "zone" && mk !== "image" ? "qcm" : type });
    } catch (e) { setErr(errText(e)); }
    setBusy("");
  };

  const problems = validateQuestion({ ...q, type });
  return <div className="card qeditor" style={{ marginBottom: "0.8rem" }}>
    <div className="section-head" style={{ marginBottom: "0.6rem" }}>
      <div className="overline" style={{ color: "#8c2f39" }}>Question {index + 1}</div>
      {canRemove && <button type="button" className="btn btn-secondary btn-sm" aria-label={`Supprimer la question ${index + 1}`} onClick={onRemove}>🗑</button>}
    </div>

    <div className="chip-row" role="group" aria-label="Type de question" style={{ marginBottom: "0.7rem" }}>
      {Object.entries(TYPES).map(([k, label]) => <button type="button" key={k} className="chip" aria-pressed={type === k} onClick={() => set({ type: k })}>{k === "qcm" ? "🔤" : k === "zone" ? "📍" : "🔢"} {label}</button>)}
    </div>

    <input className="field" style={{ marginBottom: "0.6rem" }} aria-label={`Énoncé de la question ${index + 1}`} placeholder="Tapez votre question…" value={q.q} onChange={(e) => set({ q: e.target.value })} />

    <div className="qeditor-media">
      <div className="btn-row">
        <label className="btn btn-secondary btn-sm file-btn">📎 Plan / image / PDF
          <input type="file" accept="image/*,application/pdf" hidden disabled={!!busy} onChange={(e) => { handleFile(e.target.files[0], "image"); e.target.value = ""; }} />
        </label>
        <label className="btn btn-secondary btn-sm file-btn">🧊 Maquette 3D (.ifc / .glb)
          <input type="file" accept=".ifc,.glb" hidden disabled={!!busy} onChange={(e) => { handleFile(e.target.files[0], "model"); e.target.value = ""; }} />
        </label>
        <label className="hint" htmlFor={`pg-${index}`}>page PDF</label>
        <input id={`pg-${index}`} type="number" min="1" className="field" style={{ width: 70 }} value={page} onChange={(e) => setPage(Math.max(1, +e.target.value || 1))} />
        {q.media && <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ media: null, zone: null })}>Retirer le média</button>}
      </div>
      {busy && <p className="hint" role="status">⏳ {busy}</p>}
      {err && <div className="alert" role="alert">{err}</div>}
      {q.media && type !== "zone" && <div style={{ marginTop: "0.6rem" }}><Media media={q.media} maxVh={36} /></div>}
    </div>

    {type === "zone" && (q.media?.kind === "image"
      ? <ZoneEditor src={q.media.url} zone={q.zone} onChange={(zone) => set({ zone })} />
      : <p className="hint">Ajoute d'abord une image de plan ci-dessus, puis trace la zone correcte.</p>)}

    {type === "num" && <div className="grid-2 stack-sm" style={{ gap: "0.6rem", marginTop: "0.6rem" }}>
      <div><label className="label" htmlFor={`val-${index}`}>Valeur attendue</label><input id={`val-${index}`} className="field" inputMode="decimal" value={q.value} onChange={(e) => set({ value: e.target.value.replace(",", ".") })} /></div>
      <div><label className="label" htmlFor={`tol-${index}`}>Tolérance (±)</label><input id={`tol-${index}`} className="field" inputMode="decimal" value={q.tol} onChange={(e) => set({ tol: e.target.value.replace(",", ".") })} /></div>
      <div><label className="label" htmlFor={`un-${index}`}>Unité</label><input id={`un-${index}`} className="field" placeholder="m, m², cm…" value={q.unit} onChange={(e) => set({ unit: e.target.value })} /></div>
    </div>}

    {type === "qcm" && <div className="grid-2 stack-sm" style={{ gap: "0.5rem", marginTop: "0.6rem" }}>
      {q.answers.map((a, ai) => (
        <div key={ai} className="answer-edit" data-correct={q.correct === ai}>
          <span className="dot" style={{ background: COLORS[ai] }} aria-hidden="true" />
          <input aria-label={`Réponse ${LETTRES[ai]} de la question ${index + 1}`} placeholder={`Réponse ${LETTRES[ai]}`} value={a} onChange={(e) => set({ answers: q.answers.map((x, j) => (j === ai ? e.target.value : x)) })} />
          <button type="button" className="answer-check" aria-pressed={q.correct === ai} aria-label={`Réponse ${LETTRES[ai]} : bonne réponse`} title="Marquer comme bonne réponse" onClick={() => set({ correct: ai })}>✓</button>
        </div>
      ))}
    </div>}

    <div className="chip-row" role="group" aria-label={`Temps de réponse de la question ${index + 1}`} style={{ margin: "0.8rem 0 0.4rem" }}>
      <span className="hint">Temps :</span>
      {[15, 20, 30, 45, 60, 90].map((t) => <button type="button" key={t} className="chip" aria-pressed={q.time === t} onClick={() => set({ time: t })}>{t}s</button>)}
    </div>
    <input className="field" style={{ marginTop: "0.4rem" }} aria-label="Explication affichée à la correction" placeholder="💡 Explication (facultatif, affichée après la correction)" value={q.explication || ""} onChange={(e) => set({ explication: e.target.value })} />
    <details style={{ marginTop: "0.5rem" }}>
      <summary className="hint" style={{ cursor: "pointer" }}>📋 Données BIM / tableau (facultatif)</summary>
      <textarea className="field" rows={3} style={{ marginTop: "0.4rem" }} aria-label="Tableau de données" placeholder={"Niveau : RDC\nMatériau : Béton C25/30\nÉpaisseur : 20 cm"} value={bim}
        onChange={(e) => { setBim(e.target.value); set({ donnees: e.target.value.split("\n").map((l) => { const i = l.indexOf(":"); return i > 0 ? { label: l.slice(0, i).trim(), valeur: l.slice(i + 1).trim() } : null; }).filter(Boolean) }); }} />
    </details>
    {problems.length > 0 && q.q.trim() && <p className="hint" style={{ color: "#a3152f", marginTop: "0.5rem" }}>⚠️ À compléter : {problems.join(", ")}</p>}
  </div>;
}
