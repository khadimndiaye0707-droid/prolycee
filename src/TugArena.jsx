/* eslint-disable react-refresh/only-export-components */
export const TEAMS = {
  A: { name: "Équipe Bleue", short: "BLEUE", color: "#2563eb", dot: "🔵" },
  B: { name: "Équipe Rouge", short: "ROUGE", color: "#e11d48", dot: "🔴" },
};

const MAX_SHIFT = 6;   // décalage maximal du calque mobile, en % de la largeur de la scène

// Scène photo-réaliste : terrain fixe + calque mobile (corde, ruban, équipes).
// pos > 0 : l'équipe bleue (gauche) gagne du terrain et attire le ruban à gauche.
export function Rope({ pos, max, big }) {
  const t = Math.max(-1, Math.min(1, pos / max));
  const lead = pos === 0 ? null : pos > 0 ? "A" : "B";
  return (
    <div className={`nb-scene${big ? " nb-big" : ""}`} role="img"
      aria-label={lead ? `La corde est du côté de l'${TEAMS[lead].name}` : "Corde au centre"}>
      <img className="nb-terrain" src="/tug/terrain.webp" alt="" draggable="false" />
      <span className="nb-label nb-label-a">{TEAMS.A.short}</span>
      <span className="nb-label nb-label-b">{TEAMS.B.short}</span>
      <div className="nb-mover" style={{ transform: `translateX(${(-t * MAX_SHIFT).toFixed(2)}%)` }}>
        <div className="nb-cord" />
        <div className="nb-banner" />
        <img className="nb-team-img nb-team-a" src="/tug/equipe-bleue.webp" alt="" draggable="false" />
        <img className="nb-team-img nb-team-b" src="/tug/equipe-rouge.webp" alt="" draggable="false" />
      </div>
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
