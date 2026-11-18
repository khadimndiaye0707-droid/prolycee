/* eslint-disable react-refresh/only-export-components */
export const TEAMS = {
  A: { name: "Équipe Bleue", short: "BLEUE", color: "#2563eb", dot: "🔵" },
  B: { name: "Équipe Rouge", short: "ROUGE", color: "#e11d48", dot: "🔴" },
};

const INK = "#1b1b1b";
const SKIN = ["#f6c9a0", "#d9a06b", "#8d5a3b", "#f1b98f", "#b9784a"];

// Personnage dessiné (original) : jambes, tronc, bras vers la corde, tête
function Char({ x, team, dir, i }) {
  const col = TEAMS[team].color;
  const lean = dir === 1 ? -13 : 13;
  return (
    <g transform={`translate(${x} 250) rotate(${lean})`} className="nb-char" style={{ animationDelay: `${i * 0.13}s` }}>
      <path d={`M${-7 * dir} -2 L${-13 * dir} -34 M${7 * dir} -2 L${11 * dir} -34`} stroke={INK} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d={`M${-7 * dir} -2 L${-13 * dir} -34 M${7 * dir} -2 L${11 * dir} -34`} stroke="#334155" strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="-14" y="-74" width="28" height="44" rx="9" fill={col} stroke={INK} strokeWidth="4" />
      <path d={`M${6 * dir} -62 L${dir * 40} -50`} stroke={INK} strokeWidth="10" strokeLinecap="round" />
      <path d={`M${6 * dir} -62 L${dir * 40} -50`} stroke={SKIN[i % SKIN.length]} strokeWidth="5" strokeLinecap="round" />
      <circle cx={2 * dir} cy="-90" r="14" fill={SKIN[i % SKIN.length]} stroke={INK} strokeWidth="4" />
      <path d={`M${-10 * dir} -94 Q${2 * dir} -112 ${14 * dir} -96`} fill={INK} stroke={INK} strokeWidth="3" />
      <circle cx={8 * dir} cy="-88" r="2" fill={INK} />
    </g>
  );
}

function Crowd({ side }) {
  const col = side === "A" ? TEAMS.A.color : TEAMS.B.color;
  const xs = side === "A" ? [18, 52, 86, 120, 154] : [646, 680, 714, 748, 782];
  return <g>{xs.map((x, i) => (
    <g key={x} className="nb-fan" style={{ animationDelay: `${i * 0.17}s` }}>
      <rect x={x - 12} y={206 + (i % 2) * 6} width="24" height="30" rx="8" fill={col} stroke={INK} strokeWidth="3" />
      <circle cx={x} cy={196 + (i % 2) * 6} r="11" fill={SKIN[(i + 2) % SKIN.length]} stroke={INK} strokeWidth="3" />
    </g>))}</g>;
}

// Scène illustrée du tir à la corde. pos > 0 : l'équipe A (gauche) gagne du terrain
export function Rope({ pos, max, sizes, big }) {
  const nA = Math.min(Math.max(sizes?.A || 3, 1), 5);
  const nB = Math.min(Math.max(sizes?.B || 3, 1), 5);
  const t = Math.max(-1, Math.min(1, pos / max));
  const won = Math.abs(pos) >= max ? (pos > 0 ? "A" : "B") : null;
  const shift = -t * 80;
  const ribbonX = 400 + shift;
  const lead = pos === 0 ? null : pos > 0 ? "A" : "B";
  const grpA = (i) => 300 - i * 46;
  const grpB = (i) => 500 + i * 46;
  const fall = (team) => (won && won !== team ? "nb-fall" : "");
  return (
    <svg className={`nb-scene${big ? " nb-big" : ""}`} viewBox="0 0 800 340" role="img"
      aria-label={lead ? `La corde est du côté de l'${TEAMS[lead].name}` : "Corde au centre"}>
      <defs>
        <linearGradient id="nbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7dd3fc" /><stop offset="1" stopColor="#fef9c3" /></linearGradient>
      </defs>
      <rect width="800" height="340" fill="url(#nbSky)" />
      <circle cx="400" cy="62" r="34" fill="#facc15" stroke={INK} strokeWidth="4" />
      <g fill="#fff" stroke={INK} strokeWidth="3"><ellipse cx="130" cy="70" rx="46" ry="18" /><ellipse cx="160" cy="58" rx="28" ry="16" /><ellipse cx="660" cy="96" rx="52" ry="18" /><ellipse cx="632" cy="84" rx="26" ry="14" /></g>
      <path d="M0 200 Q120 140 250 196 T520 190 T800 180 V260 H0Z" fill="#86efac" stroke={INK} strokeWidth="4" />
      <text x="14" y="30" fontFamily="Inter,system-ui,sans-serif" fontWeight="900" fontSize="22" fill={TEAMS.A.color} stroke={INK} strokeWidth="1">{TEAMS.A.short}</text>
      <text x="786" y="30" textAnchor="end" fontFamily="Inter,system-ui,sans-serif" fontWeight="900" fontSize="22" fill={TEAMS.B.color} stroke={INK} strokeWidth="1">{TEAMS.B.short}</text>
      <Crowd side="A" /><Crowd side="B" />
      <rect x="0" y="250" width="330" height="90" fill="#65a30d" stroke={INK} strokeWidth="5" />
      <rect x="470" y="250" width="330" height="90" fill="#65a30d" stroke={INK} strokeWidth="5" />
      <rect x="330" y="250" width="140" height="90" fill="#7c4a1e" stroke={INK} strokeWidth="5" />
      <g fill="#a16207" stroke={INK} strokeWidth="3"><circle className="nb-bubble" cx="365" cy="290" r="9" /><circle className="nb-bubble b2" cx="410" cy="305" r="12" /><circle className="nb-bubble b3" cx="445" cy="285" r="8" /></g>
      <path d="M0 252 H330 M470 252 H800" stroke="#4d7c0f" strokeWidth="8" />
      <path d="M300 18 V0 M0 0" stroke="none" />
      <g className={`nb-team ${fall("A")}`} style={{ transform: `translateX(${shift}px)` }}>
        {Array.from({ length: nA }, (_, i) => <Char key={i} x={grpA(i)} team="A" dir={1} i={i} />)}
      </g>
      <g className={`nb-team ${fall("B")}`} style={{ transform: `translateX(${shift}px)` }}>
        {Array.from({ length: nB }, (_, i) => <Char key={i} x={grpB(i)} team="B" dir={-1} i={i + 2} />)}
      </g>
      <path d="M0 0" />
      <path d={`M${grpA(0) + 44} 196 Q${400 + shift} 222 ${grpB(0) - 44} 196`} stroke={INK} strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={`M${grpA(0) + 44} 196 Q${400 + shift} 222 ${grpB(0) - 44} 196`} stroke="#d97706" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="10 5" />
      <g className="nb-ribbon" style={{ transform: `translateX(${ribbonX - 400}px)` }}>
        <rect x="388" y="190" width="24" height="42" rx="4" fill="#facc15" stroke={INK} strokeWidth="4" />
        <path d="M400 232 L400 250" stroke={INK} strokeWidth="4" />
      </g>
      <path d="M400 250 V276" stroke="#fff" strokeWidth="4" strokeDasharray="5 4" opacity=".7" />
    </svg>
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
