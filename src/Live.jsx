// ── QUIZ LIVE — jeu en temps réel type Kahoot (code PIN + code personnel) ──
// Trois écrans : LiveHost (prof), LiveJoin (élève, page /jouer), Roster (liste de classe + codes)
// et LiveChampionship (classement cumulé des compétitions).
import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { TEAMS, Rope, Confetti } from "./TugArena";
import { supabase } from "./supabase";
import { QuestionView, Media } from "./QuizParts";
import { answerSpec, publicQuestion } from "./quizLogic";
import { useSecret } from "./hooks";

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const LETTRES = ["A", "B", "C", "D"];
const CLASSES = { seconde: "🏛️ Seconde", premiere: "📐 1ère TBAA", terminale: "🏗️ Terminale TBAA" };
const MODES = {
  competition: { icon: "🏆", label: "Compétition", sub: "Classement en direct, points cumulés au championnat" },
  revision: { icon: "📖", label: "Révision", sub: "Sans classement, sans pression, pas de points de championnat" },
  tug: { icon: "🪢", label: "Tug of War", sub: "Deux équipes : chaque bonne réponse tire la corde de ton côté" },
};
const tugMax = (n) => Math.max(3, Math.round((n || 10) * 0.4));   // écart de bonnes réponses (par élève) qui fait gagner

// Position de la corde : bonnes réponses de l'équipe A (par élève) moins celles de l'équipe B
function tugState(players, answers, max) {
  const size = { A: players.filter((p) => p.team === "A").length, B: players.filter((p) => p.team === "B").length };
  const team = Object.fromEntries(players.map((p) => [p.id, p.team]));
  const byQ = new Map();
  answers.forEach((a) => {
    const t = team[a.player_id];
    if (a.correct == null || !t) return;
    const o = byQ.get(a.q_index) || { A: 0, B: 0 };
    if (a.correct) o[t] += 1;
    byQ.set(a.q_index, o);
  });
  let raw = 0;
  byQ.forEach((o) => { raw += (size.A ? o.A / size.A : 0) - (size.B ? o.B / size.B : 0); });
  return { raw, max, pos: Math.max(-max, Math.min(max, raw)), size, won: Math.abs(raw) >= max, leader: raw > 0 ? "A" : raw < 0 ? "B" : null };
}


const now = () => Date.now();
const errText = (e) => (e && e.message ? e.message : "Erreur de connexion");

function Medal({ i }) { return <>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</>; }

// ════════════════════════════════════════════════════════════════
//  PROF — pilote une partie
// ════════════════════════════════════════════════════════════════
export function LiveHost({ quiz, onExit, initialMode }) {
  const [secret, saveSecret] = useSecret();
  const [mode, setMode] = useState(initialMode || "competition");
  const [classe, setClasse] = useState(quiz.filiere || "terminale");
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [totals, setTotals] = useState([]);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  const revealing = useRef(false);
  const revealRef = useRef(null);

  const gid = game?.id;
  const status = game?.status;
  const qIdx = game?.q_index ?? -1;
  const q = qIdx >= 0 ? quiz.questions[qIdx] : null;
  const joinUrl = game ? `${window.location.origin}/jouer?pin=${game.pin}` : "";

  useEffect(() => { window.scrollTo(0, 0); }, [status, qIdx]);

  // QR code vers la page élève
  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { width: 260, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [joinUrl]);

  const refresh = useCallback(async () => {
    if (!gid) return;
    const [p, a, t] = await Promise.all([
      supabase.from("live_players").select("id,nom,roster_id,team").eq("game_id", gid).order("created_at"),
      supabase.from("live_answers").select("player_id,q_index,choice,correct,points,x,y,value,created_at").eq("game_id", gid),
      supabase.from("live_totals").select("*").eq("game_id", gid).order("total", { ascending: false }),
    ]);
    if (p.data) setPlayers(p.data);
    if (a.data) setAnswers(a.data);
    if (t.data) setTotals(t.data);
  }, [gid]);

  // Temps réel + relevé de secours toutes les 2,5 s
  useEffect(() => {
    if (!gid) return;
    refresh();
    const ch = supabase.channel(`host-${gid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_players", filter: `game_id=eq.${gid}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_answers", filter: `game_id=eq.${gid}` }, refresh)
      .subscribe();
    const iv = setInterval(refresh, 2500);
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [gid, refresh]);

  const rpc = async (fn, args) => {
    const { data, error: e } = await supabase.rpc(fn, args);
    if (e) throw e;
    return data;
  };

  const createGame = async () => {
    if (!secret.trim()) { setError("Saisis ton code prof"); return; }
    setBusy(true); setError("");
    try {
      const g = await rpc("host_create_game", {
        p_secret: secret.trim(), p_titre: quiz.title, p_mode: mode,
        p_classe: classe === "all" ? "" : classe, p_total: quiz.questions.length,
      });
      setGame(g);
    } catch (e) { setError(errText(e)); }
    setBusy(false);
  };

  const setTeam = async (pid, team) => {
    setPlayers((ps) => ps.map((p) => (p.id === pid ? { ...p, team: team || null } : p)));
    try { await rpc("host_set_team", { p_secret: secret, p_player: pid, p_team: team || "" }); }
    catch (e) { setError(errText(e)); refresh(); }
  };

  const askQuestion = async (i) => {
    const qq = quiz.questions[i];
    setBusy(true); setError("");
    try {
      await rpc("host_set_question", {
        p_secret: secret, p_game: gid, p_index: i,
        p_question: publicQuestion(qq),   // sans la bonne réponse
      });
      revealing.current = false;
      setGame((g) => ({ ...g, status: "question", q_index: i, correct: null }));
      setTimer(qq.time || 30);
    } catch (e) { setError(errText(e)); }
    setBusy(false);
  };

  const reveal = async () => {
    if (revealing.current || !q) return;
    revealing.current = true;
    try {
      await rpc("host_reveal", { p_secret: secret, p_game: gid, p_answer: answerSpec(q), p_time: q.time || 30 });
      setGame((g) => ({ ...g, status: "reveal", correct: q.correct }));
      await refresh();
    } catch (e) { setError(errText(e)); revealing.current = false; }
  };
  revealRef.current = reveal;

  const finish = async () => {
    setBusy(true);
    try {
      await rpc("host_finish", { p_secret: secret, p_game: gid });
      setGame((g) => ({ ...g, status: "finished" }));
      await refresh();
    } catch (e) { setError(errText(e)); }
    setBusy(false);
  };

  // Compte à rebours ; correction automatique à 0
  useEffect(() => {
    if (status !== "question") return;
    const iv = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(iv); setTimeout(() => revealRef.current && revealRef.current(), 0); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [status, qIdx]);

  const answersQ = answers.filter((a) => a.q_index === qIdx);
  const unassigned = players.filter((p) => !p.team).length;
  const tug = tugState(players, answers, tugMax(quiz.questions.length));
  const tugReady = players.length > 0 && unassigned === 0 && tug.size.A > 0 && tug.size.B > 0;

  // Correction anticipée dès que tout le monde a répondu
  useEffect(() => {
    if (status === "question" && players.length > 0 && answersQ.length >= players.length) {
      const t = setTimeout(() => revealRef.current && revealRef.current(), 700);
      return () => clearTimeout(t);
    }
  }, [status, players.length, answersQ.length]);

  const toggleFs = () => { const el = document.getElementById("nb-monitor"); if (document.fullscreenElement) document.exitFullscreen(); else el?.requestFullscreen?.(); };
  const tugTop = game?.mode === "tug" ? <>
    <div className="nb-topbar">
      <div className="nb-join"><span>REJOINS&nbsp;:</span><b className="num">{game.pin}</b>{qr && <img src={qr} alt="QR code pour rejoindre" width="56" height="56" />}</div>
      <div className="nb-actions"><button type="button" className="nb-btn" onClick={toggleFs}>⛶ Plein écran</button></div>
    </div>
    <Rope pos={tug.pos} max={tug.max} sizes={tug.size} big />
  </> : null;

  const header = (title) => (
    <header className="page-head" data-size="sm">
      <button type="button" className="btn btn-secondary btn-sm" onClick={onExit}>✕ Quitter</button>
      <div className="page-head-text"><h1 className="page-title">{title}</h1></div>
      {game && <span className="badge live-mode-badge">{MODES[game.mode].icon} {MODES[game.mode].label}</span>}
    </header>
  );

  // ── Réglages avant création ──
  if (!game) {
    return <div>
      {header(`Lancer en live — ${quiz.title}`)}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="form-row">
          <div className="label" id="live-mode">Type de séance</div>
          <div className="live-modes" role="group" aria-labelledby="live-mode">
            {Object.entries(MODES).map(([k, m]) => (
              <button type="button" key={k} className="mode-card" aria-pressed={mode === k}
                data-selected={mode === k} onClick={() => setMode(k)} style={{ "--accent": k === "competition" ? "#a16207" : "#0e7490" }}>
                <span className="mode-icon" aria-hidden="true">{m.icon}</span>
                <span className="mode-title">{m.label}</span>
                <span className="mode-sub">{m.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="label" id="live-classe">Classe autorisée</div>
          <div className="chip-row" role="group" aria-labelledby="live-classe">
            {Object.entries(CLASSES).map(([k, label]) => (
              <button type="button" key={k} className="chip" aria-pressed={classe === k} onClick={() => setClasse(k)}>{label}</button>
            ))}
            {mode !== "competition" && <button type="button" className="chip" aria-pressed={classe === "all"} onClick={() => setClasse("all")}>Toutes</button>}
          </div>
        </div>
        <div className="form-row">
          <label className="label" htmlFor="live-secret">Code prof</label>
          <input id="live-secret" type="password" className="field" placeholder="Le code défini dans Supabase" value={secret} onChange={(e) => saveSecret(e.target.value)} />
        </div>
        {error && <div className="alert" role="alert">{error}</div>}
        <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={createGame}>{busy ? "⏳ Création…" : "📡 Ouvrir la salle"}</button>
      </div>
    </div>;
  }

  // ── Salle d'attente ──
  if (status === "lobby") {
    return <div>
      {header(game.titre)}
      <div className="card live-lobby">
        <div className="overline">Rejoindre sur <b>{window.location.host}/jouer</b></div>
        <div className="pin-display num" aria-label={`Code de la partie ${game.pin.split("").join(" ")}`}>{game.pin}</div>
        {qr && <img className="live-qr" src={qr} alt="QR code pour rejoindre la partie" width="200" height="200" />}
        <p className="hint">{game.mode === "competition" ? "Les élèves entrent le code PIN puis leur code personnel." : "Les élèves entrent le code PIN puis leur code personnel ou un pseudo."}</p>
      </div>
      <div className="card" style={{ margin: "1rem 0" }}>
        <div className="overline" style={{ marginBottom: "0.6rem" }}>👥 {players.length} connecté{players.length > 1 ? "s" : ""}</div>
        {game.mode === "tug" ? <div className="tug-teams">
          {players.map((p) => <div key={p.id} className="score-row">
            <span className="score-name">{p.nom}</span>
            <span className="tug-pick" role="group" aria-label={`Équipe de ${p.nom}`}>
              {["A", "B"].map((t) => <button type="button" key={t} className="btn btn-sm" aria-pressed={p.team === t}
                style={p.team === t ? { background: TEAMS[t].color, color: "#fff", borderColor: TEAMS[t].color } : { borderColor: TEAMS[t].color, color: TEAMS[t].color }}
                onClick={() => setTeam(p.id, p.team === t ? "" : t)}>{TEAMS[t].dot} {t === "A" ? "Bleue" : "Rouge"}</button>)}
            </span>
          </div>)}
          {players.length === 0 && <span className="hint">En attente des élèves…</span>}
          <p className="hint" style={{ marginTop: "0.6rem" }}>🔵 {players.filter((p) => p.team === "A").length} · 🔴 {players.filter((p) => p.team === "B").length}{unassigned > 0 ? ` · ⚠ ${unassigned} sans équipe` : ""}</p>
        </div> : <div className="live-players">
          {players.map((p) => <span key={p.id} className="badge live-player">{p.nom}</span>)}
          {players.length === 0 && <span className="hint">En attente des élèves…</span>}
        </div>}
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      <button type="button" className="btn btn-primary btn-lg" disabled={busy || players.length === 0 || (game.mode === "tug" && !tugReady)} onClick={() => askQuestion(0)}>{game.mode === "tug" && !tugReady ? "Place chaque élève dans une équipe" : "▶ Lancer la 1ère question"}</button>
    </div>;
  }

  // ── Question en cours ──
  if (status === "question" && q) {
    const timerColor = timer <= 5 ? "#c81e3a" : timer <= 10 ? "#a16207" : "#8c2f39";
    return <div id={game.mode === "tug" ? "nb-monitor" : undefined} className={game.mode === "tug" ? "nb-monitor nb-flow" : undefined}>
      {game.mode === "tug" ? tugTop : header(game.titre)}
      <div className="card card-accent kh-question">
        <div className="page-meta num">Question {qIdx + 1}/{quiz.questions.length}</div>
        <h2 className="kh-q">{q.q}</h2>
        <div className="kh-timer" role="timer" style={{ color: timerColor }}>{timer}<small>s</small></div>
        <div className="kh-timebar" aria-hidden="true"><div style={{ width: `${Math.max(0, Math.min(100, (timer / (q.time || 30)) * 100))}%`, background: timerColor }} /></div>
      </div>
      {q.media && <Media media={q.media} maxVh={56} />}
      {q.donnees?.length > 0 && <table className="table bim-table"><tbody>{q.donnees.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{d.valeur}</td></tr>)}</tbody></table>}
      {(q.type || "qcm") === "qcm" ? <div className="kh-grid">
        {q.answers.map((a, i) => a && (
          <div key={i} className="kh-answer" data-state="idle" style={{ "--kh": COLORS[i] }}>
            <span className="kh-letter" aria-hidden="true">{LETTRES[i]}</span><span className="kh-text">{a}</span>
          </div>
        ))}
      </div> : <p className="banner" data-tone="neutral">{q.type === "zone" ? "📍 Les élèves touchent le plan à l'endroit demandé." : `🔢 Les élèves saisissent une valeur${q.unit ? ` (en ${q.unit})` : ""}.`}</p>}
      <p className="live-count num" role="status">✋ {answersQ.length} / {players.length} réponses</p>
      {error && <div className="alert" role="alert">{error}</div>}
      <button type="button" className="btn btn-secondary" onClick={reveal}>Corriger maintenant</button>
    </div>;
  }

  // ── Correction ──
  if (status === "reveal" && q) {
    const qt = q.type || "qcm";
    const counts = qt === "qcm" ? q.answers.map((_, i) => answersQ.filter((a) => a.choice === i).length) : [];
    const nbOk = answersQ.filter((a) => a.correct).length;
    const spec = answerSpec(q);
    const dots = qt === "zone" ? answersQ.filter((a) => a.x != null).map((a) => ({ x: +a.x, y: +a.y, ok: a.correct })) : [];
    const last = qIdx + 1 >= quiz.questions.length || (game.mode === "tug" && tug.won);
    const teamOk = (t) => answersQ.filter((a) => a.correct && players.find((p) => p.id === a.player_id)?.team === t).length;
    return <div id={game.mode === "tug" ? "nb-monitor" : undefined} className={game.mode === "tug" ? "nb-monitor nb-flow" : undefined}>
      {game.mode === "tug" ? tugTop : header(game.titre)}
      <div className="card kh-question"><h2 className="kh-q">{q.q}</h2></div>
      {q.media && <Media media={q.media} maxVh={56} rect={qt === "zone" ? q.zone : null} dots={dots} />}
      {qt === "qcm" && <div className="kh-grid">
        {q.answers.map((a, i) => a && (
          <div key={i} className="kh-answer" data-state={i === q.correct ? "correct" : "muted"} style={{ "--kh": COLORS[i], ...(i === q.correct ? {} : { background: `${COLORS[i]}33` }) }}>
            <span className="kh-letter" aria-hidden="true">{i === q.correct ? "✓" : LETTRES[i]}</span>
            <span className="kh-text">{a}</span>
            <span className="live-bar-count num">{counts[i]}</span>
          </div>
        ))}
      </div>}
      {qt === "num" && <p className="banner" data-tone="neutral">Valeur attendue : <b>{spec.value}{spec.unit ? ` ${spec.unit}` : ""}</b>{spec.tol ? ` (± ${spec.tol})` : ""} · {answersQ.length ? `réponses : ${answersQ.map((a) => a.value).join(" ; ")}` : "aucune réponse"}</p>}
      {qt === "zone" && <p className="hint" style={{ textAlign: "center", margin: "0.4rem 0 1rem" }}>🟢 bonne réponse · 🔴 mauvaise · rectangle = zone attendue</p>}
      {spec.explication && <p className="banner" data-tone="neutral">💡 {spec.explication}</p>}
      {game.mode === "competition" ? (
        <div className="card" style={{ margin: "1rem 0" }}>
          <div className="overline" style={{ marginBottom: "0.3rem" }}>🏆 Classement</div>
          {totals.slice(0, 5).map((t, i) => (
            <div key={t.player_id} className="score-row">
              <span className="score-pos num"><Medal i={i} /></span><span className="score-name">{t.nom}</span><span className="score-pts num">{t.total} pts</span>
            </div>
          ))}
        </div>
      ) : game.mode === "tug" ? (
        <div className="nb-scores" style={{ margin: "1rem 0" }}>
          <div className="nb-score" style={{ background: TEAMS.A.color }}><span>{TEAMS.A.name}</span><b className="num">{teamOk("A")}<small>/{tug.size.A}</small></b></div>
          <div className="nb-feed"><div className="nb-feed-title">⚡ CETTE QUESTION</div><div className="nb-feed-row" style={{ borderLeftColor: "#111" }}>{tug.won ? "La corde est au bout !" : "La corde se déplace…"}</div></div>
          <div className="nb-score" style={{ background: TEAMS.B.color }}><span>{TEAMS.B.name}</span><b className="num">{teamOk("B")}<small>/{tug.size.B}</small></b></div>
        </div>
      ) : (
        <p className="banner" data-tone="neutral" style={{ margin: "1rem 0" }}>📖 Révision : {nbOk} élève{nbOk > 1 ? "s" : ""} sur {answersQ.length} {nbOk > 1 ? "ont" : "a"} trouvé la bonne réponse.</p>
      )}
      {error && <div className="alert" role="alert">{error}</div>}
      <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => (last ? finish() : askQuestion(qIdx + 1))}>
        {last ? "Terminer 🏁" : "Question suivante →"}
      </button>
    </div>;
  }

  // ── Fin ──
  const nbQ = quiz.questions.length;
  return <div className="result">
    <div className="result-emoji" aria-hidden="true">🏆</div>
    <h1 className="page-title" style={{ marginBottom: "1rem" }}>Partie terminée</h1>
    {game.mode === "tug" && <div className="nb-monitor" style={{ marginBottom: "1.5rem" }}>
      <Confetti />
      <Rope pos={tug.pos} max={tug.max} sizes={tug.size} big />
      <div className="nb-winner" style={{ background: tug.leader ? TEAMS[tug.leader].color : "#facc15", color: tug.leader ? "#fff" : "#111" }}>{tug.leader ? `${TEAMS[tug.leader].dot} ${TEAMS[tug.leader].name.toUpperCase()} GAGNE !` : "ÉGALITÉ !"}</div>
    </div>}
    {game.mode !== "tug" && <div className="card" style={{ textAlign: "left", marginBottom: "1.5rem" }}>
      <h2 className="section-title" style={{ marginBottom: "0.6rem" }}>{game.mode === "competition" ? "Classement final" : "Résultats de la révision"}</h2>
      {totals.map((t, i) => (
        <div key={t.player_id} className="score-row">
          <span className="score-pos num">{game.mode === "competition" ? <Medal i={i} /> : "•"}</span>
          <span className="score-name">{t.nom}</span>
          <span className="score-pts num">{game.mode === "competition" ? `${t.total} pts` : `${t.bonnes}/${nbQ} bonnes réponses`}</span>
        </div>
      ))}
    </div>}
    {game.mode === "competition" && <p className="hint" style={{ marginBottom: "1rem" }}>Ces points sont ajoutés au championnat.</p>}
    <button type="button" className="btn btn-primary" onClick={onExit}>← Retour aux quiz</button>
  </div>;
}

// ════════════════════════════════════════════════════════════════
//  ÉLÈVE — page /jouer (aucune connexion requise)
// ════════════════════════════════════════════════════════════════
export function LiveJoin() {
  const params = new URLSearchParams(window.location.search);
  const [pin, setPin] = useState(params.get("pin") || "");
  const [code, setCode] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [me, setMe] = useState(() => { try { return JSON.parse(sessionStorage.getItem("prolycee_live_me")); } catch { return null; } });
  const [game, setGame] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);     // { correct, points }
  const [rank, setRank] = useState(null);         // { pos, total, nb }
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(0);
  const lastQ = useRef(-2);
  const [team, setTeam] = useState(null);          // Tug of War : mon équipe
  const [tugView, setTugView] = useState(null);    // Tug of War : état de la corde

  const gid = me?.game_id;

  const join = async () => {
    setBusy(true); setError("");
    const { data, error: e } = await supabase.rpc("join_game", { p_pin: pin.trim(), p_code: code.trim(), p_nom: pseudo.trim() });
    if (e) setError(errText(e));
    else {
      const m = Array.isArray(data) ? data[0] : data;
      sessionStorage.setItem("prolycee_live_me", JSON.stringify(m));
      setMe(m);
    }
    setBusy(false);
  };

  const leave = () => { sessionStorage.removeItem("prolycee_live_me"); setMe(null); setGame(null); setChosen(null); setResult(null); setRank(null); lastQ.current = -2; setTeam(null); setTugView(null); };

  const applyGame = useCallback((g) => {
    setGame((prev) => (prev && JSON.stringify(prev) === JSON.stringify(g) ? prev : g));
  }, []);

  // Suivi de la partie : temps réel + relevé de secours toutes les 2 s
  useEffect(() => {
    if (!gid) return;
    const load = async () => {
      const { data } = await supabase.from("live_games").select("*").eq("id", gid).single();
      if (data) applyGame(data);
      if (data?.mode === "tug") {
        const [pl, an] = await Promise.all([
          supabase.from("live_players").select("id,team").eq("game_id", gid),
          supabase.from("live_answers").select("player_id,q_index,correct").eq("game_id", gid),
        ]);
        if (pl.data && an.data) {
          const mine = pl.data.find((x) => x.id === me.player_id);
          setTeam(mine?.team || null);
          setTugView(tugState(pl.data, an.data, tugMax(data.total)));
        }
      }
    };
    load();
    const ch = supabase.channel(`play-${gid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_games", filter: `id=eq.${gid}` }, (p) => applyGame(p.new))
      .subscribe();
    const iv = setInterval(load, 2000);
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [gid, applyGame, me?.player_id]);

  // Nouvelle question : on réinitialise et on lance le chrono
  useEffect(() => {
    if (!game || game.status !== "question") return;
    if (lastQ.current === game.q_index) return;
    lastQ.current = game.q_index;
    shownAt.current = now();
    setChosen(null); setResult(null); setRank(null);
    setTimer(game.question?.time || 30);
  }, [game]);

  useEffect(() => {
    if (game?.status !== "question") return;
    const iv = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [game?.status, game?.q_index]);

  // Correction / fin : on récupère mon résultat et mon rang
  useEffect(() => {
    if (!game || !me || (game.status !== "reveal" && game.status !== "finished")) return;
    (async () => {
      const [a, t] = await Promise.all([
        supabase.from("live_answers").select("correct,points,choice,x,y,value").eq("player_id", me.player_id).eq("q_index", game.q_index).maybeSingle(),
        supabase.from("live_totals").select("player_id,total").eq("game_id", game.id).order("total", { ascending: false }),
      ]);
      if (a.data) setResult(a.data); else setResult({ correct: false, points: 0, none: true });
      if (t.data) {
        const pos = t.data.findIndex((x) => x.player_id === me.player_id);
        setRank({ pos: pos + 1, nb: t.data.length, total: t.data[pos]?.total ?? 0 });
      }
    })();
  }, [game?.status, game?.q_index, game?.id, me]);   // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (payload) => {
    if (chosen !== null || game.status !== "question") return;
    setChosen(payload);
    const ms = now() - shownAt.current;
    const { error: e } = await supabase.rpc("submit_answer", {
      p_player: me.player_id, p_q: game.q_index, p_choice: payload.choice ?? null, p_ms: ms,
      p_x: payload.x ?? null, p_y: payload.y ?? null, p_value: payload.value ?? null,
    });
    if (e) setError(errText(e));
  };

  const competition = (game?.mode || me?.mode) === "competition";
  const isTug = (game?.mode || me?.mode) === "tug";

  let body;
  if (!me) {
    body = <form noValidate onSubmit={(e) => { e.preventDefault(); join(); }}>
      <div className="form-row">
        <label className="label" htmlFor="j-pin">Code de la partie</label>
        <input id="j-pin" className="field live-input" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="123456" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div className="form-row">
        <label className="label" htmlFor="j-code">Ton code personnel</label>
        <input id="j-code" className="field live-input" autoCapitalize="characters" autoComplete="off" maxLength={4} placeholder="K7M2" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      </div>
      <div className="form-row">
        <label className="label" htmlFor="j-pseudo">Pseudo <span className="hint">(révision seulement, si tu n'as pas de code)</span></label>
        <input id="j-pseudo" className="field" maxLength={20} autoComplete="off" value={pseudo} onChange={(e) => setPseudo(e.target.value)} />
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || pin.length < 6}>{busy ? "⏳ …" : "Rejoindre →"}</button>
    </form>;
  } else if (!game) {
    body = <p className="live-wait" role="status">⏳ Connexion…</p>;
  } else if (isTug && game.status === "lobby") {
    body = <div className="live-center"><div className="result-emoji" aria-hidden="true">🪢</div><h2 className="page-title">{me.nom}</h2>
      {team ? <p className="banner" data-tone="ok" style={{ borderColor: TEAMS[team].color }}>Tu es dans l'<b style={{ color: TEAMS[team].color }}>{TEAMS[team].dot} {TEAMS[team].name}</b></p>
        : <p className="hint">Le prof va te placer dans une équipe…</p>}
      <p className="hint">Regarde l'écran : la partie va bientôt commencer.</p></div>;
  } else if (isTug && game.status === "finished") {
    const win = tugView?.leader;
    body = <div className="live-center" role="status"><div className="result-emoji" aria-hidden="true">🏁</div><h2 className="page-title">Partie terminée !</h2>
      {win === team && <Confetti />}
      {tugView && <Rope pos={tugView.pos} max={tugView.max} sizes={tugView.size} />}
      {win ? <p className="banner" data-tone={win === team ? "ok" : "neutral"}>{win === team ? "🎉 Ton équipe a gagné !" : `${TEAMS[win].dot} ${TEAMS[win].name} gagne.`}</p> : <p className="banner" data-tone="neutral">Égalité !</p>}
      <button type="button" className="btn btn-primary" onClick={leave}>Quitter</button></div>;
  } else if (game.status === "lobby") {
    body = <div className="live-center"><div className="result-emoji" aria-hidden="true">🙌</div><h2 className="page-title">C'est bon, {me.nom} !</h2><p className="hint">Regarde l'écran : la partie va bientôt commencer.</p></div>;
  } else if (isTug && game.status === "question" && !team) {
    body = <p className="live-wait" role="status">⏳ Le prof te place dans une équipe…</p>;
  } else if (game.status === "question") {
    const qq = game.question;
    const timerColor = timer <= 5 ? "#c81e3a" : timer <= 10 ? "#a16207" : "#8c2f39";
    body = <div>
      <div className="live-qhead"><span className="page-meta num">Question {game.q_index + 1}/{game.total}</span><span className="kh-timer-sm num" style={{ color: timerColor }}>{timer}s</span></div>
      <h2 className="kh-q live-q">{qq?.q}</h2>
      {chosen === null
        ? <QuestionView key={game.q_index} q={qq} onAnswer={answer} />
        : <div className="live-center" role="status"><div className="result-emoji" aria-hidden="true">✅</div><p><b>Réponse envoyée !</b></p><p className="hint">Attends la correction.</p></div>}
      {error && <div className="alert" role="alert">{error}</div>}
    </div>;
  } else if (game.status === "reveal") {
    body = <div className="live-center" role="status">
      {!result ? <p>⏳</p> : result.none
        ? <><div className="result-emoji" aria-hidden="true">⏱️</div><h2 className="page-title">Pas de réponse</h2></>
        : result.correct
          ? <><div className="result-emoji" aria-hidden="true">🎉</div><h2 className="page-title">Bonne réponse !</h2>{competition && <p className="live-pts num">+{result.points} pts</p>}</>
          : <><div className="result-emoji" aria-hidden="true">😅</div><h2 className="page-title">Raté…</h2></>}
      {result && !result.none && game.question && <div style={{ textAlign: "left" }}><QuestionView key={`r${game.q_index}`} q={{ ...game.question, answers: game.question.answers }} locked reveal={{ spec: game.reveal || { type: "qcm", correct: game.correct }, mine: result }} /></div>}
      {result?.none && game.question && <div style={{ textAlign: "left" }}><QuestionView key={`r${game.q_index}`} q={game.question} locked reveal={{ spec: game.reveal || { type: "qcm", correct: game.correct }, mine: null }} /></div>}
      {isTug && tugView && <Rope pos={tugView.pos} max={tugView.max} sizes={tugView.size} />}
      {competition && rank && <p className="banner" data-tone="neutral">Tu es <b>{rank.pos}{rank.pos === 1 ? "er" : "e"}</b> sur {rank.nb} · {rank.total} pts</p>}
    </div>;
  } else {
    body = <div className="live-center" role="status">
      <div className="result-emoji" aria-hidden="true">🏁</div><h2 className="page-title">Partie terminée !</h2>
      {competition && rank && <p className="banner" data-tone="ok">Classement final : <b>{rank.pos}{rank.pos === 1 ? "er" : "e"}</b> sur {rank.nb} · {rank.total} pts</p>}
      {!competition && <p className="hint">Bravo pour ta révision 👏</p>}
      <button type="button" className="btn btn-primary" onClick={leave}>Quitter</button>
    </div>;
  }

  return <div className="live-wrap">
    <div className="live-brand"><span className="brand-name">Pro<span>Lycée</span></span>{me && game?.status !== "finished" && <button type="button" className="link-btn" onClick={leave}>Quitter</button>}</div>
    <main className="card live-card">
      {isTug && team && game?.status !== "finished" && <p className="banner" data-tone="neutral" style={{ borderColor: TEAMS[team].color, marginTop: 0 }}>{TEAMS[team].dot} {TEAMS[team].name}</p>}
      {body}
    </main>
  </div>;
}

// Accès au site : code élève commun (modifiable) et code prof personnel
const makeCode = (len = 8) => {
  const alpha = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; const a = new Uint32Array(len); crypto.getRandomValues(a);
  const c = Array.from(a, (n) => alpha[n % alpha.length]).join("");
  return len === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

function AccessPanel({ secret, onProfCodeChanged }) {
  const [studentCode, setStudentCode] = useState(null);
  const [show, setShow] = useState(false);
  const [newStudent, setNewStudent] = useState("");
  const [newProf, setNewProf] = useState("");
  const [confirm, setConfirm] = useState("");        // "student" | "prof" : attend la confirmation
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const loadCode = async () => {
    const { data, error: e } = await supabase.rpc("host_get_student_code", { p_secret: secret.trim() });
    if (e) setErr(errText(e)); else setStudentCode(data || "");
  };
  useEffect(() => {
    let off = false;
    supabase.rpc("host_get_student_code", { p_secret: secret.trim() }).then(({ data, error: e }) => {
      if (off) return;
      if (e) setErr(errText(e)); else setStudentCode(data || "");
    });
    return () => { off = true; };
  }, [secret]);

  const run = async (fn, args, ok) => {
    setBusy(true); setErr(""); setMsg("");
    const { error: e } = await supabase.rpc(fn, args);
    setBusy(false); setConfirm("");
    if (e) { setErr(errText(e)); return false; }
    setMsg(ok); return true;
  };
  const saveStudent = async () => {
    if (await run("host_set_student_code", { p_secret: secret.trim(), p_code: newStudent }, "Code élève modifié : tous les élèves connectés avec l'ancien code sont déconnectés. Donne-leur le nouveau code.")) { setNewStudent(""); loadCode(); }
  };
  const saveProf = async () => {
    const code = newProf.trim();
    if (await run("host_set_prof_secret", { p_secret: secret.trim(), p_new: code }, "Code prof modifié : les autres appareils prof sont déconnectés. Garde-le précieusement.")) { onProfCodeChanged(code); setNewProf(""); }
  };

  return <div className="card" style={{ marginBottom: "1rem" }}>
    <div className="overline">🔐 Accès au site</div>
    <p className="hint">Le site est fermé : il faut un code pour entrer. Le code élève est commun à la classe et n'ouvre jamais les fonctions prof.</p>
    <div className="form-row">
      <span className="label">Code élève actuel</span>
      <div className="btn-row">
        <b className="roster-code num" aria-live="polite">{studentCode === null ? "…" : studentCode ? (show ? studentCode : "••••••••") : "aucun (personne ne peut entrer)"}</b>
        {studentCode && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShow((v) => !v)}>{show ? "Masquer" : "Afficher"}</button>}
      </div>
    </div>
    <div className="form-row">
      <label className="label" htmlFor="ac-student">Nouveau code élève (6 caractères minimum)</label>
      <div className="btn-row">
        <input id="ac-student" className="field" style={{ maxWidth: 240 }} autoComplete="off" value={newStudent} onChange={(e) => { setNewStudent(e.target.value); setConfirm(""); }} />
        <button type="button" className="btn btn-secondary" onClick={() => { setNewStudent(makeCode()); setConfirm(""); }}>🎲 Générer</button>
        {confirm === "student"
          ? <button type="button" className="btn btn-primary" disabled={busy} onClick={saveStudent}>Confirmer : déconnecter les élèves</button>
          : <button type="button" className="btn btn-primary" disabled={busy || newStudent.trim().length < 6} onClick={() => setConfirm("student")}>Changer le code élève</button>}
      </div>
      <div className="hint">Changer le code déconnecte aussitôt tous les élèves qui avaient l'ancien : ils devront saisir le nouveau.</div>
    </div>
    <div className="form-row">
      <label className="label" htmlFor="ac-prof">Nouveau code prof personnel (12 caractères minimum)</label>
      <div className="btn-row">
        <input id="ac-prof" type="password" className="field" style={{ maxWidth: 240 }} autoComplete="new-password" value={newProf} onChange={(e) => { setNewProf(e.target.value); setConfirm(""); }} />
        {confirm === "prof"
          ? <button type="button" className="btn btn-primary" disabled={busy} onClick={saveProf}>Confirmer</button>
          : <button type="button" className="btn btn-secondary" disabled={busy || newProf.trim().length < 12} onClick={() => setConfirm("prof")}>Changer mon code prof</button>}
      </div>
    </div>
    {msg && <div className="banner" data-tone="ok" role="status">✅ {msg}</div>}
    {err && <div className="alert" role="alert">{err}</div>}
  </div>;
}

// ════════════════════════════════════════════════════════════════
//  PROF — liste de classe et codes personnels
// ════════════════════════════════════════════════════════════════
export function Roster() {
  const [secret, saveSecret] = useSecret();
  const [classe, setClasse] = useState("terminale");
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setError("");
    const { data, error: e } = await supabase.rpc("host_roster_list", { p_secret: secret.trim() });
    if (e) { setError(errText(e)); setRows(null); } else setRows(data);
  };
  useEffect(() => {
    if (!secret.trim()) return;
    let off = false;
    supabase.rpc("host_roster_list", { p_secret: secret.trim() }).then(({ data, error: e }) => {
      if (off) return;
      if (e) { setError(errText(e)); setRows(null); } else setRows(data);
    });
    return () => { off = true; };
  }, [secret]);

  const add = async () => {
    const list = names.split("\n").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true); setError("");
    for (const nom of list) {
      const { error: e } = await supabase.rpc("host_roster_add", { p_secret: secret.trim(), p_classe: classe, p_nom: nom });
      if (e) { setError(errText(e)); break; }
    }
    setNames(""); setBusy(false); load();
  };

  const del = async (id) => {
    const { error: e } = await supabase.rpc("host_roster_delete", { p_secret: secret.trim(), p_id: id });
    if (e) setError(errText(e)); else load();
  };

  const shown = (rows || []).filter((r) => r.classe === classe);
  const copy = async () => {
    const txt = shown.map((r) => `${r.nom}\t${r.code}`).join("\n");
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignoré */ }
  };

  return <div>
    <header className="page-head"><span className="page-icon" aria-hidden="true">🧑‍🎓</span>
      <div className="page-head-text"><h1 className="page-title">Élèves & codes</h1><p className="page-sub">Chaque élève a un code personnel de 4 caractères pour jouer en compétition.</p></div></header>
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div className="form-row">
        <label className="label" htmlFor="r-secret">Code prof</label>
        <div className="btn-row">
          <input id="r-secret" type="password" className="field" style={{ maxWidth: 280 }} value={secret} onChange={(e) => saveSecret(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={load}>Afficher la liste</button>
        </div>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
    </div>
    {rows && <>
      <AccessPanel secret={secret} onProfCodeChanged={saveSecret} />
      <div className="chip-row" role="group" aria-label="Classe" style={{ marginBottom: "1rem" }}>
        {Object.entries(CLASSES).map(([k, label]) => <button type="button" key={k} className="chip" aria-pressed={classe === k} onClick={() => setClasse(k)}>{label}</button>)}
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <label className="label" htmlFor="r-names">Ajouter des élèves — un nom par ligne ({CLASSES[classe]})</label>
        <textarea id="r-names" className="field" rows={4} placeholder={"Amara D.\nYoussef M."} value={names} onChange={(e) => setNames(e.target.value)} />
        <div style={{ marginTop: "0.7rem" }}><button type="button" className="btn btn-primary" disabled={busy || !names.trim()} onClick={add}>{busy ? "⏳ …" : "+ Ajouter et générer les codes"}</button></div>
      </div>
      <div className="card">
        <div className="section-head"><h2 className="section-title">{CLASSES[classe]} · {shown.length} élève{shown.length > 1 ? "s" : ""}</h2>
          <div className="section-action"><button type="button" className="btn btn-secondary btn-sm" onClick={copy} disabled={!shown.length}>{copied ? "✓ Copié" : "Copier la liste"}</button></div></div>
        {shown.map((r) => (
          <div key={r.id} className="score-row">
            <span className="score-name">{r.nom}</span>
            <span className="roster-code num">{r.code}</span>
            <button type="button" className="btn btn-secondary btn-sm" aria-label={`Supprimer ${r.nom}`} onClick={() => del(r.id)}>✕</button>
          </div>
        ))}
        {shown.length === 0 && <p className="hint">Aucun élève dans cette classe pour le moment.</p>}
      </div>
    </>}
  </div>;
}

// ════════════════════════════════════════════════════════════════
//  Championnat cumulé des compétitions live
// ════════════════════════════════════════════════════════════════
export function LiveChampionship() {
  const [rows, setRows] = useState(null);
  const [classe, setClasse] = useState("all");

  useEffect(() => {
    supabase.from("championnat").select("*").then(({ data }) => setRows(data || []));
  }, []);

  if (rows === null) return <div className="card"><div role="status" style={{ textAlign: "center", padding: "2rem", color: "#5b6472" }}>⏳ Chargement…</div></div>;

  const games = [...new Map(rows.map((r) => [r.game_id, r])).values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byPlayer = new Map();
  for (const r of rows) {
    const p = byPlayer.get(r.roster_id) || { nom: r.nom, classe: r.classe, total: 0, pts: {} };
    p.total += r.pts; p.pts[r.game_id] = r.pts; byPlayer.set(r.roster_id, p);
  }
  const list = [...byPlayer.values()].filter((p) => classe === "all" || p.classe === classe).sort((a, b) => b.total - a.total);
  const shownGames = games.slice(-6);

  return <div>
    <div className="chip-row" role="group" aria-label="Filtrer par classe" style={{ marginBottom: "1rem" }}>
      {[["all", "Toutes"], ...Object.entries(CLASSES)].map(([k, label]) => <button type="button" key={k} className="chip" aria-pressed={classe === k} onClick={() => setClasse(k)}>{label}</button>)}
    </div>
    {list.length === 0 ? (
      <div className="card"><p className="hint" style={{ textAlign: "center", padding: "1.5rem 0" }}>Aucune compétition terminée pour le moment. Lance un quiz en live en mode 🏆 Compétition !</p></div>
    ) : (
      <div className="card">
        <div className="section-head"><h2 className="section-title">🏆 Classement cumulé · {games.length} compétition{games.length > 1 ? "s" : ""}</h2></div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Classement du championnat">
          <table className="table">
            <thead><tr><th scope="col">#</th><th scope="col">Élève</th><th scope="col">Classe</th>
              {shownGames.map((g, i) => <th key={g.game_id} scope="col" className="r" title={g.titre}>C{games.length - shownGames.length + i + 1}</th>)}
              <th scope="col" className="r">Total</th></tr></thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.nom + i}>
                  <td className="num" style={{ color: "#854d0e", fontWeight: 700 }}><Medal i={i} /></td>
                  <td className="cell-name">{p.nom}</td>
                  <td>{CLASSES[p.classe]}</td>
                  {shownGames.map((g) => <td key={g.game_id} className="r num">{p.pts[g.game_id] ?? "–"}</td>)}
                  <td className="r num" style={{ fontWeight: 700, color: "#854d0e" }}>{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>;
}
