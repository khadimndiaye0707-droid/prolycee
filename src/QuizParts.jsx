// ── Briques communes des quiz BTP : plans zoomables, zone cliquable, réponse numérique,
//    tableau BIM, vue 3D, import JSON (ChatGPT). Utilisées en solo, en live (prof + élève).
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { COLORS, LETTRES } from "./quizLogic";
import { useMediaUrl } from "./media";

const Model3D = lazy(() => import("./Model3D"));

// ════════════════════════════════════════════════════════════════
//  Plan / image zoomable (pincer, molette, glisser) avec pointage
// ════════════════════════════════════════════════════════════════
export function ZoomImage({ src, alt = "Plan", onPick, marker, rect, dots, maxVh = 52 }) {
  const box = useRef(null);
  const inner = useRef(null);
  const [ar, setAr] = useState(1.4);
  const [v, setV] = useState({ s: 1, x: 0, y: 0 });
  const vRef = useRef(v);
  const pts = useRef(new Map());
  const g = useRef({ moved: false, pinch: null, pan: null });
  const setView = (nv) => { vRef.current = nv; setV(nv); };

  const limit = (s, x, y) => {
    const w = inner.current.offsetWidth, h = inner.current.offsetHeight;
    return { s, x: Math.min(0, Math.max(w * (1 - s), x)), y: Math.min(0, Math.max(h * (1 - s), y)) };
  };
  const zoomAt = (ns, cx, cy) => {
    const c = vRef.current; const s = Math.min(6, Math.max(1, ns)); const r = s / c.s;
    setView(limit(s, cx - (cx - c.x) * r, cy - (cy - c.y) * r));
  };

  useEffect(() => {
    const el = box.current;
    const onWheel = (e) => {
      e.preventDefault();
      const b = el.getBoundingClientRect();
      zoomAt(vRef.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - b.left, e.clientY - b.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const down = (e) => {
    box.current.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gg = g.current; gg.moved = false;
    const arr = [...pts.current.values()];
    if (arr.length === 2) gg.pinch = { d: Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y), v: { ...vRef.current } };
    gg.pan = { x: e.clientX, y: e.clientY, v: { ...vRef.current } };
  };
  const move = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gg = g.current; const arr = [...pts.current.values()];
    if (arr.length === 2 && gg.pinch) {
      gg.moved = true;
      const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      const b = box.current.getBoundingClientRect();
      const s = Math.min(6, Math.max(1, gg.pinch.v.s * d / gg.pinch.d)); const r = s / gg.pinch.v.s;
      const cx = (arr[0].x + arr[1].x) / 2 - b.left, cy = (arr[0].y + arr[1].y) / 2 - b.top;
      setView(limit(s, cx - (cx - gg.pinch.v.x) * r, cy - (cy - gg.pinch.v.y) * r));
    } else if (arr.length === 1 && gg.pan) {
      const dx = e.clientX - gg.pan.x, dy = e.clientY - gg.pan.y;
      if (Math.hypot(dx, dy) > 6) gg.moved = true;
      if (gg.moved && gg.pan.v.s > 1) setView(limit(gg.pan.v.s, gg.pan.v.x + dx, gg.pan.v.y + dy));
    }
  };
  const up = (e) => {
    const gg = g.current;
    const wasSingle = pts.current.size === 1;
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) gg.pinch = null;
    if (wasSingle && !gg.moved && onPick) {
      const r = inner.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onPick({ x, y });
    }
    if (pts.current.size === 1) { const p = [...pts.current.values()][0]; gg.pan = { x: p.x, y: p.y, v: { ...vRef.current } }; gg.moved = true; }
  };

  const center = (f) => { const b = box.current.getBoundingClientRect(); zoomAt(vRef.current.s * f, b.width / 2, b.height / 2); };

  return <div className="zoomimg">
    <div ref={box} className="zoomimg-box" style={{ touchAction: "none", cursor: onPick ? "crosshair" : v.s > 1 ? "grab" : "default" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div ref={inner} className="zoomimg-inner" style={{ width: `min(100%, ${maxVh * ar}vh)`, aspectRatio: ar, transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})` }}>
        <img src={src} alt={alt} draggable="false" onLoad={(e) => setAr(e.target.naturalWidth / e.target.naturalHeight || 1.4)} />
        {rect && <div className="zoomimg-rect" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} />}
        {(dots || []).map((d, i) => <span key={i} className="zoomimg-dot" data-ok={d.ok ? "true" : "false"} style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }} />)}
        {marker && <span className="zoomimg-marker" style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} />}
      </div>
    </div>
    <div className="zoomimg-tools" role="group" aria-label="Zoom du plan">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => center(1 / 1.4)} aria-label="Dézoomer">−</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => center(1.4)} aria-label="Zoomer">+</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView({ s: 1, x: 0, y: 0 })}>↺</button>
    </div>
  </div>;
}

export function Media({ media, onPick, marker, rect, dots, maxVh }) {
  const url = useMediaUrl(media?.url);
  if (!media?.url) return null;
  if (url === null) return <div className="model3d model3d-loading" role="status">⏳ Chargement…</div>;
  if (url === "") return <div className="alert" role="alert">Image indisponible (accès expiré ?).</div>;
  if (media.kind === "model") {
    return <Suspense fallback={<div className="model3d model3d-loading" role="status">⏳ Chargement de la maquette 3D…</div>}>
      <Model3D url={url} />
    </Suspense>;
  }
  return <ZoomImage src={url} onPick={onPick} marker={marker} rect={rect} dots={dots} maxVh={maxVh} />;
}

export function DataTable({ donnees }) {
  if (!donnees?.length) return null;
  return <table className="table bim-table" aria-label="Données BIM"><tbody>
    {donnees.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{d.valeur}</td></tr>)}
  </tbody></table>;
}

// ════════════════════════════════════════════════════════════════
//  Affichage d'une question pour celui qui répond (solo ou élève en live)
//  reveal : null (question en cours) ou { spec, mine } à la correction
// ════════════════════════════════════════════════════════════════
export function QuestionView({ q, onAnswer, locked, reveal }) {
  const [marker, setMarker] = useState(null);
  const [num, setNum] = useState("");
  const type = q.type || "qcm";
  const spec = reveal?.spec;
  const mine = reveal?.mine;
  const canPick = type === "zone" && !locked && !reveal;
  const shownMarker = reveal ? (mine?.x != null ? { x: +mine.x, y: +mine.y } : null) : marker;
  const rect = reveal && type === "zone" && spec ? { x: spec.x, y: spec.y, w: spec.w, h: spec.h } : null;

  return <div className="qview">
    <DataTable donnees={q.donnees} />
    {q.media && <Media media={q.media} onPick={canPick ? setMarker : undefined} marker={shownMarker} rect={rect} />}
    {type === "zone" && !reveal && !locked && <div className="qview-zone">
      <p className="hint">{marker ? "Ton choix est placé. Tu peux le déplacer en touchant ailleurs." : "Touche le plan à l'endroit demandé (pince pour zoomer)."}</p>
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!marker} onClick={() => onAnswer({ x: marker.x, y: marker.y })}>Valider ma réponse</button>
    </div>}
    {type === "num" && !reveal && !locked && <form className="qview-num" onSubmit={(e) => { e.preventDefault(); const v = parseFloat(num.replace(",", ".")); if (Number.isFinite(v)) onAnswer({ value: v }); }}>
      <label className="label" htmlFor="qv-num">Ta réponse{q.unit ? ` (en ${q.unit})` : ""}</label>
      <div className="btn-row">
        <input id="qv-num" className="field live-input" inputMode="decimal" autoComplete="off" value={num} onChange={(e) => setNum(e.target.value)} placeholder="0,00" />
        <button type="submit" className="btn btn-primary btn-lg" disabled={!Number.isFinite(parseFloat(num.replace(",", ".")))}>Valider</button>
      </div>
    </form>}
    {type === "num" && reveal && spec && <p className="banner" data-tone="neutral">Valeur attendue : <b>{spec.value}{spec.unit ? ` ${spec.unit}` : ""}</b>{spec.tol ? ` (± ${spec.tol})` : ""}{mine?.value != null ? ` · ta réponse : ${mine.value}` : ""}</p>}
    {type === "qcm" && <div className="kh-grid live-grid">
      {(q.answers || []).map((a, i) => {
        if (!a) return null;
        const state = !reveal ? "idle" : i === spec?.correct ? "correct" : i === mine?.choice ? "wrong" : "muted";
        return <button type="button" key={i} className="kh-answer" data-state={state} disabled={!!reveal || locked}
          style={{ "--kh": COLORS[i], ...(state === "muted" ? { background: `${COLORS[i]}33` } : {}) }} onClick={() => onAnswer({ choice: i })}>
          <span className="kh-letter" aria-hidden="true">{state === "correct" ? "✓" : state === "wrong" ? "✕" : LETTRES[i]}</span>
          <span className="kh-text">{a}</span>
        </button>;
      })}
    </div>}
    {reveal && spec?.explication && <p className="banner" data-tone="neutral">💡 {spec.explication}</p>}
  </div>;
}

// ════════════════════════════════════════════════════════════════
//  Prof : dessiner la zone correcte sur le plan
// ════════════════════════════════════════════════════════════════
export function ZoneEditor({ src: rawSrc, zone, onChange }) {
  const src = useMediaUrl(rawSrc) || "";
  const el = useRef(null);
  const [ar, setAr] = useState(1.4);
  const [drag, setDrag] = useState(null);
  const pos = (e) => { const r = el.current.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  const shown = drag ? rectOf(drag.a, drag.b) : zone;
  return <div className="zone-editor">
    <p className="hint">Trace avec le doigt ou la souris le rectangle qui sera accepté comme bonne réponse.</p>
    <div ref={el} className="zoomimg-inner zone-editor-box" style={{ width: `min(100%, ${52 * ar}vh)`, aspectRatio: ar, touchAction: "none", cursor: "crosshair" }}
      onPointerDown={(e) => { el.current.setPointerCapture(e.pointerId); const p = pos(e); setDrag({ a: p, b: p }); }}
      onPointerMove={(e) => drag && setDrag({ a: drag.a, b: pos(e) })}
      onPointerUp={() => { if (drag) { const r = rectOf(drag.a, drag.b); if (r.w > 0.01 && r.h > 0.01) onChange(r); setDrag(null); } }}>
      <img src={src} alt="Plan à pointer" draggable="false" onLoad={(e) => setAr(e.target.naturalWidth / e.target.naturalHeight || 1.4)} />
      {shown && <div className="zoomimg-rect" style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }} />}
    </div>
  </div>;
}
