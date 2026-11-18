/* eslint-disable react-refresh/only-export-components */
export const TEAMS = {
  A: { name: "Équipe Bleue", short: "BLEUE", color: "#2563eb", dot: "🔵" },
  B: { name: "Équipe Rouge", short: "ROUGE", color: "#e11d48", dot: "🔴" },
};

// Scène de tir à la corde (style néo-brutalisme : aplats, gros contours, ombres dures)
export function Rope({ pos, max, sizes, big }) {
  const pct = 50 + (pos / max) * 40;                       // 10 % … 90 %
  const nA = Math.min(Math.max(sizes?.A || 3, 1), 6);
  const nB = Math.min(Math.max(sizes?.B || 3, 1), 6);
  const shift = (pos / max) * 14;                          // les équipes suivent la corde
  const lead = pos === 0 ? null : pos > 0 ? "A" : "B";
  return (
    <div className={`nb-arena${big ? " nb-big" : ""}`} role="img"
      aria-label={lead ? `La corde est du côté de l'${TEAMS[lead].name}` : "Corde au centre"}>
      <div className="nb-head">
        <span className="nb-tag" style={{ background: TEAMS.A.color }}>{TEAMS.A.short}</span>
        <span className="nb-vs">VS</span>
        <span className="nb-tag" style={{ background: TEAMS.B.color }}>{TEAMS.B.short}</span>
      </div>
      <div className="nb-field">
        <div className="nb-zone nb-zone-a" /><div className="nb-zone nb-zone-b" />
        <div className="nb-mid" />
        <div className="nb-crew nb-crew-a" style={{ transform: `translateX(${shift}%)` }}>
          {Array.from({ length: nA }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }}>🧑‍🎓</span>)}
        </div>
        <div className="nb-crew nb-crew-b" style={{ transform: `translateX(${shift}%)` }}>
          {Array.from({ length: nB }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }}>🧑‍🎓</span>)}
        </div>
        <div className="nb-rope" />
        <div className="nb-flag" style={{ left: `${pct}%` }}><span key={Math.round(pos * 100)}>🚩</span></div>
      </div>
      <div className="nb-ground" />
    </div>
  );
}

const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const BITS = Array.from({ length: 48 }, (_, i) => ({
  l: Math.round(rnd(i, 1) * 100), d: (rnd(i, 2) * 1.6).toFixed(2), t: (2.4 + rnd(i, 3) * 2).toFixed(2),
  c: ["#facc15", "#2563eb", "#e11d48", "#16a34a", "#111"][i % 5], r: Math.round(rnd(i, 4) * 360),
}));

export function Confetti() {
  return <div className="nb-confetti" aria-hidden="true">
    {BITS.map((b, i) => <i key={i} style={{ left: `${b.l}%`, background: b.c, animationDelay: `${b.d}s`, animationDuration: `${b.t}s`, transform: `rotate(${b.r}deg)` }} />)}
  </div>;
}
