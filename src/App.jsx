import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#0d0f14", surface: "#151820", surface2: "#1c2030",
  border: "rgba(255,255,255,0.07)", orange: "#ff6b2b", orange2: "#ff8c5a",
  blue: "#3d9fff", green: "#22d3a0", red: "#ff4d6d", yellow: "#ffd166",
  purple: "#a78bfa", text: "#e8eaf0", muted: "#6b7280",
  elec: "#3d9fff", cvc: "#ff4d6d", mis: "#22d3a0",
  xp: "#ffd166", xpBg: "rgba(255,209,102,0.12)",
};

// ── XP SYSTEM ────────────────────────────────────────────────
const LEVELS = [
  { level: 1, name: "Apprenti",       icon: "🔌", xpMin: 0,    color: "#6b7280" },
  { level: 2, name: "Câbleur",        icon: "🔧", xpMin: 500,  color: "#3d9fff" },
  { level: 3, name: "Électricien",    icon: "⚡", xpMin: 1500, color: "#22d3a0" },
  { level: 4, name: "Chef de chantier",icon:"🏗️", xpMin: 3000, color: "#a78bfa" },
  { level: 5, name: "Maître Élec",    icon: "👑", xpMin: 6000, color: "#ffd166" },
];

const XP_GAINS = {
  kahoot_correct: 100,
  kahoot_win: 300,
  tug_correct: 150,
  tug_win: 200,
  resource_view: 20,
  combo_3: 50,
  combo_5: 150,
};

function getLevelInfo(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.xpMin) current = l; }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  const progress = next
    ? Math.round(((xp - current.xpMin) / (next.xpMin - current.xpMin)) * 100)
    : 100;
  return { current, next, progress };
}

// Global XP store (simulated per-session)
const XP_STORE = {};
STUDENTS_DATA().forEach(st => { XP_STORE[st.name] = st.xp || 0; });
function STUDENTS_DATA() {
  return [
    { name:"Amara D.",    classe:"elec", s1:16, s2:15, s3:14, kahoot:1050, avg:15.2, xp:2800 },
    { name:"Youssef M.",  classe:"elec", s1:14, s2:13, s3:15, kahoot:920,  avg:14,   xp:1900 },
    { name:"Kevin T.",    classe:"cvc",  s1:12, s2:14, s3:11, kahoot:780,  avg:12.5, xp:1200 },
    { name:"Saliou B.",   classe:"mis",  s1:17, s2:16, s3:18, kahoot:1200, avg:17,   xp:4200 },
    { name:"Lucas P.",    classe:"elec", s1:10, s2:11, s3:9,  kahoot:600,  avg:10,   xp:680  },
    { name:"Fatou N.",    classe:"cvc",  s1:15, s2:14, s3:16, kahoot:950,  avg:15,   xp:2100 },
    { name:"Thomas R.",   classe:"mis",  s1:13, s2:12, s3:14, kahoot:820,  avg:13,   xp:1450 },
  ];
}
const STUDENTS = STUDENTS_DATA();

const SEQUENCES = {
  elec:[
    {num:"01",title:"Installations basse tension",periode:"Sept–Oct",semaines:"S1–S6",
     resources:[{icon:"📖",name:"Cours — Notions BT",s:"ok"},{icon:"🎬",name:"Vidéo — Introduction BT",s:"wip"},{icon:"🛠️",name:"TP — Câblage tableau",s:"ok"},{icon:"📝",name:"TD — Schémas unifilaires",s:"ok"},{icon:"🎮",name:"Kahoot — Quiz BT",s:"soon"}]},
    {num:"02",title:"Protection des personnes",periode:"Nov–Déc",semaines:"S7–S13",
     resources:[{icon:"📖",name:"Cours — Protections différentielles",s:"ok"},{icon:"🎬",name:"Vidéo — Disjoncteurs",s:"soon"},{icon:"🛠️",name:"TP — Mise en œuvre protections",s:"wip"},{icon:"📝",name:"TD — Calcul protections",s:"ok"}]},
    {num:"03",title:"Domotique et gestion technique",periode:"Jan–Fév",semaines:"S14–S20",
     resources:[{icon:"📖",name:"Cours — Domotique",s:"soon"},{icon:"🛠️",name:"TP — Programmation KNX",s:"soon"},{icon:"🎮",name:"Kahoot — Domotique",s:"soon"}]},
    {num:"04",title:"Éclairage et efficacité énergétique",periode:"Mars–Juin",semaines:"S21–S35",
     resources:[{icon:"📖",name:"Cours — LED & économies",s:"soon"},{icon:"📝",name:"TD — Calcul éclairement",s:"soon"}]},
  ],
  cvc:[
    {num:"01",title:"Thermodynamique appliquée",periode:"Sept–Oct",semaines:"S1–S6",
     resources:[{icon:"📖",name:"Cours — Lois thermodynamique",s:"ok"},{icon:"🎬",name:"Vidéo — Transferts de chaleur",s:"wip"},{icon:"📝",name:"TD — Calculs thermiques",s:"ok"}]},
    {num:"02",title:"Chauffage central",periode:"Nov–Déc",semaines:"S7–S13",
     resources:[{icon:"📖",name:"Cours — Chaudières & émetteurs",s:"ok"},{icon:"🛠️",name:"TP — Réglage chaudière",s:"ok"},{icon:"🎬",name:"Vidéo — Entretien chaudière",s:"soon"}]},
    {num:"03",title:"Ventilation et traitement d'air",periode:"Jan–Fév",semaines:"S14–S20",
     resources:[{icon:"📖",name:"Cours — VMC simple et double flux",s:"ok"},{icon:"🛠️",name:"TP — Installation VMC",s:"wip"},{icon:"📝",name:"TD — Dimensionnement réseau",s:"soon"}]},
    {num:"04",title:"Climatisation & froid",periode:"Mars–Juin",semaines:"S21–S35",
     resources:[{icon:"📖",name:"Cours — Cycle frigorifique",s:"soon"},{icon:"🎮",name:"Kahoot — Climatisation",s:"soon"}]},
  ],
  mis:[
    {num:"01",title:"Réseau de distribution d'eau",periode:"Sept–Oct",semaines:"S1–S6",
     resources:[{icon:"📖",name:"Cours — Distribution AEP",s:"ok"},{icon:"🎬",name:"Vidéo — Réseau EF/EC",s:"ok"},{icon:"🛠️",name:"TP — Lecture plans sanitaires",s:"ok"},{icon:"📝",name:"TD — Schémas de principe",s:"ok"},{icon:"🎮",name:"Kahoot — Distribution",s:"soon"}]},
    {num:"02",title:"Raccordements et assemblages",periode:"Nov–Déc",semaines:"S7–S13",
     resources:[{icon:"📖",name:"Cours — Techniques assemblage",s:"ok"},{icon:"🎬",name:"Vidéo — Sertissage et collage",s:"wip"},{icon:"🛠️",name:"TP — Raccordement",s:"ok"}]},
    {num:"03",title:"Appareils sanitaires",periode:"Jan–Fév",semaines:"S14–S20",
     resources:[{icon:"📖",name:"Cours — WC, lavabo, douche",s:"ok"},{icon:"🛠️",name:"TP — Pose WC suspendu",s:"wip"},{icon:"🎮",name:"Kahoot — Appareils sanitaires",s:"soon"}]},
    {num:"04",title:"Évacuations EU/EP",periode:"Mars–Avr",semaines:"S21–S27",
     resources:[{icon:"📖",name:"Cours — Réseaux EU, EV, EP",s:"ok"},{icon:"📝",name:"TD — Dimensionnement évacuations",s:"soon"}]},
    {num:"05",title:"Production ECS & économies d'eau",periode:"Mai–Juin",semaines:"S28–S36",
     resources:[{icon:"📖",name:"Cours — Chauffe-eau",s:"soon"},{icon:"🎮",name:"Kahoot — Bilan annuel",s:"soon"}]},
  ]
};

const TOW_QS = {
  elec:[
    {q:"Quelle est la couleur du fil de phase ?",a:"marron"},
    {q:"Que signifie DDR ?",a:"dispositif différentiel résiduel"},
    {q:"Quelle tension pour le réseau domestique en France ?",a:"230"},
    {q:"Quel outil mesure le courant électrique ?",a:"ampèremètre"},
    {q:"Quelle est la couleur du fil de terre ?",a:"vert jaune"},
  ],
  cvc:[
    {q:"Que signifie VMC ?",a:"ventilation mécanique contrôlée"},
    {q:"Quel fluide circule dans un circuit de chauffage central ?",a:"eau"},
    {q:"Que signifie ECS ?",a:"eau chaude sanitaire"},
    {q:"Quel gaz réfrigérant écologique ?",a:"r32"},
    {q:"Quel appareil chauffe l'eau sanitaire ?",a:"chauffe-eau"},
  ],
  mis:[
    {q:"À quoi sert un siphon dans une installation sanitaire ?",a:"éviter les remontées d'odeurs"},
    {q:"Quelle couleur désigne le tuyau d'eau froide ?",a:"bleu"},
    {q:"Que signifie EF dans une installation sanitaire ?",a:"eau froide"},
    {q:"Quel outil coupe les tubes en cuivre ?",a:"coupe-tube"},
    {q:"Pression de test d'étanchéité ?",a:"3 bars"},
  ]
};

const SAMPLE_QUIZ = {
  id:1, title:"Installations BT — Séquence 1", filiere:"elec",
  questions:[
    {q:"Quelle est la couleur du fil de phase ?",answers:["Marron","Bleu","Vert-Jaune","Rouge"],correct:0,time:20},
    {q:"À quoi sert un disjoncteur différentiel ?",answers:["Protéger les personnes","Mesurer le courant","Économiser l'énergie","Couper le réseau"],correct:0,time:30},
    {q:"Que signifie BT ?",answers:["Basse Tension","Bonne Tension","Base Technique","Bloc Terminal"],correct:0,time:15},
    {q:"Quelle est la couleur du fil neutre ?",answers:["Bleu","Marron","Vert","Noir"],correct:0,time:20},
  ]
};

const s = {
  card:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"1.2rem"},
  btn:(bg=C.orange,color="white")=>({background:bg,color,border:"none",borderRadius:8,padding:"0.5rem 1rem",fontWeight:700,fontSize:"0.82rem",textTransform:"uppercase",letterSpacing:"0.5px",cursor:"pointer"}),
  input:{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"0.6rem 0.8rem",color:C.text,fontSize:"0.9rem",outline:"none",fontFamily:"inherit"},
  badge:(bg,color)=>({display:"inline-block",background:bg,color,fontSize:"0.65rem",fontWeight:700,padding:"0.2rem 0.5rem",borderRadius:4,textTransform:"uppercase",letterSpacing:"0.5px"}),
};

function Badge({type,children}){
  const map={elec:[`rgba(61,159,255,0.15)`,C.elec],cvc:[`rgba(255,77,109,0.15)`,C.cvc],mis:[`rgba(34,211,160,0.15)`,C.mis],green:["rgba(34,211,160,0.15)",C.green],orange:["rgba(255,107,43,0.15)",C.orange],yellow:["rgba(255,209,102,0.15)",C.yellow],purple:["rgba(167,139,250,0.15)",C.purple]};
  const [bg,color]=map[type]||map.green;
  return <span style={s.badge(bg,color)}>{children}</span>;
}

function Btn({onClick,color=C.orange,textColor="white",sm,children,style={}}){
  return <button onClick={onClick} style={{...s.btn(color,textColor),padding:sm?"0.35rem 0.7rem":"0.55rem 1.1rem",fontSize:sm?"0.72rem":"0.82rem",...style}}>{children}</button>;
}

function Card({children,style={}}){
  return <div style={{...s.card,...style}}>{children}</div>;
}

function SectionTitle({children}){
  return <div style={{fontSize:"0.95rem",fontWeight:800,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"1rem"}}>{children}</div>;
}

function Progress({value,color}){
  return (
    <div style={{background:C.bg,borderRadius:100,height:6,overflow:"hidden",marginTop:"0.4rem"}}>
      <div style={{width:`${value}%`,height:"100%",borderRadius:100,background:color,transition:"width 0.6s"}}/>
    </div>
  );
}

function NotePill({val}){
  const color = val>=14?C.green:val>=10?C.yellow:C.red;
  const bg = val>=14?"rgba(34,211,160,0.15)":val>=10?"rgba(255,209,102,0.15)":"rgba(255,77,109,0.15)";
  return <span style={{...s.badge(bg,color),fontSize:"0.8rem",padding:"0.2rem 0.6rem"}}>{val}</span>;
}

// ── XP BADGE ─────────────────────────────────────────────────
function XPBadge({xp, size="sm"}) {
  const { current } = getLevelInfo(xp);
  const big = size === "lg";
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:"0.3rem",
      background:`${current.color}20`, border:`1px solid ${current.color}50`,
      borderRadius:20, padding: big ? "0.4rem 0.9rem" : "0.2rem 0.6rem",
      fontSize: big ? "0.85rem" : "0.68rem", fontWeight:700, color:current.color,
    }}>
      <span>{current.icon}</span>
      <span>{current.name}</span>
    </span>
  );
}

// ── XP BAR ───────────────────────────────────────────────────
function XPBar({xp, showLabel=true}) {
  const { current, next, progress } = getLevelInfo(xp);
  return (
    <div>
      {showLabel && (
        <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.72rem",marginBottom:"0.3rem"}}>
          <span style={{color:C.xp,fontWeight:700}}>⭐ {xp} XP</span>
          {next && <span style={{color:C.muted}}>{next.xpMin - xp} XP → {next.icon} {next.name}</span>}
          {!next && <span style={{color:C.yellow}}>👑 Niveau max !</span>}
        </div>
      )}
      <div style={{background:C.bg,borderRadius:100,height:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
        <div style={{
          width:`${progress}%`, height:"100%", borderRadius:100,
          background:`linear-gradient(90deg, ${current.color}, ${current.color}cc)`,
          transition:"width 0.8s ease", boxShadow:`0 0 8px ${current.color}60`
        }}/>
      </div>
    </div>
  );
}

// ── XP TOAST ─────────────────────────────────────────────────
function XPToast({gain, label, onDone}) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position:"fixed", top:80, right:20, zIndex:9999,
      background:"linear-gradient(135deg,#1c2030,#151820)",
      border:`1px solid ${C.yellow}40`, borderRadius:14,
      padding:"0.8rem 1.2rem", display:"flex", alignItems:"center", gap:"0.8rem",
      boxShadow:`0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${C.yellow}20`,
      animation:"slideIn 0.3s ease",
    }}>
      <style>{`@keyframes slideIn{from{transform:translateX(120px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{fontSize:"1.5rem"}}>⭐</div>
      <div>
        <div style={{fontWeight:900, color:C.yellow, fontSize:"1.1rem"}}>+{gain} XP</div>
        <div style={{fontSize:"0.72rem", color:C.muted}}>{label}</div>
      </div>
    </div>
  );
}

// ── LEVEL UP MODAL ────────────────────────────────────────────
function LevelUpModal({level, onClose}) {
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,0.8)",
      display:"flex",alignItems:"center",justifyContent:"center"
    }}>
      <div style={{
        background:C.surface, border:`2px solid ${level.color}`,
        borderRadius:20, padding:"3rem", textAlign:"center", maxWidth:340,
        boxShadow:`0 0 60px ${level.color}40`,
        animation:"popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)"
      }}>
        <style>{`@keyframes popIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{fontSize:"4rem",marginBottom:"0.5rem"}}>{level.icon}</div>
        <div style={{fontSize:"0.8rem",fontWeight:700,textTransform:"uppercase",letterSpacing:2,color:C.muted,marginBottom:"0.3rem"}}>Niveau {level.level} atteint !</div>
        <div style={{fontSize:"1.8rem",fontWeight:900,color:level.color,marginBottom:"1.5rem"}}>{level.name}</div>
        <Btn onClick={onClose} color={level.color} style={{color:"#0d0f14"}}>🎉 Super !</Btn>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
function Login({onLogin}){
  const [tab,setTab]=useState("prof");
  const [name,setName]=useState("");
  const [classe,setClasse]=useState("elec");
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"2.5rem",width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{width:60,height:60,background:C.orange,borderRadius:14,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem",marginBottom:"0.8rem"}}>🏗️</div>
          <div style={{fontSize:"2rem",fontWeight:900,textTransform:"uppercase",letterSpacing:1}}>ProLycée</div>
          <div style={{fontSize:"0.75rem",color:C.muted,letterSpacing:2,textTransform:"uppercase"}}>Plateforme pédagogique</div>
        </div>
        <div style={{display:"flex",gap:"0.5rem",background:C.bg,borderRadius:10,padding:4,marginBottom:"1.5rem"}}>
          {["prof","eleve"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"0.6rem",border:"none",background:tab===t?C.surface2:"none",color:tab===t?C.text:C.muted,borderRadius:8,fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>
              {t==="prof"?"👨‍🏫 Professeur":"👨‍🎓 Élève"}
            </button>
          ))}
        </div>
        {tab==="prof" ? (
          <>
            <div style={{marginBottom:"1rem"}}>
              <div style={{fontSize:"0.72rem",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:C.muted,marginBottom:"0.4rem"}}>Identifiant</div>
              <input style={s.input} defaultValue="prof.khadim" readOnly/>
            </div>
            <div style={{marginBottom:"1rem"}}>
              <div style={{fontSize:"0.72rem",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:C.muted,marginBottom:"0.4rem"}}>Mot de passe</div>
              <input type="password" style={s.input} defaultValue="1234" readOnly/>
            </div>
            <button onClick={()=>onLogin({role:"prof",name:"M. Khadim"})} style={{...s.btn(),width:"100%",padding:"0.85rem",fontSize:"1rem"}}>Se connecter →</button>
          </>
        ):(
          <>
            <div style={{marginBottom:"1rem"}}>
              <div style={{fontSize:"0.72rem",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:C.muted,marginBottom:"0.4rem"}}>Ton prénom</div>
              <input style={s.input} placeholder="Entre ton prénom..." value={name} onChange={e=>setName(e.target.value)}/>
            </div>
            <div style={{marginBottom:"1.5rem"}}>
              <div style={{fontSize:"0.72rem",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:C.muted,marginBottom:"0.4rem"}}>Ta classe</div>
              <select style={s.input} value={classe} onChange={e=>setClasse(e.target.value)}>
                <option value="elec">⚡ Bac Pro Électricité</option>
                <option value="cvc">🔥 Bac Pro CVC</option>
                <option value="mis">🔧 CAP MIS</option>
              </select>
            </div>
            <button onClick={()=>{if(name.trim())onLogin({role:"eleve",name:name.trim(),classe,xp:420});else alert("Entre ton prénom !")}} style={{...s.btn(),width:"100%",padding:"0.85rem",fontSize:"1rem"}}>Rejoindre →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────
function Sidebar({active,setActive,user}){
  const items=[
    {id:"dashboard",icon:"🏠",label:"Tableau de bord"},
    {id:"classes",icon:"📚",label:"Mes Classes"},
    {id:"notes",icon:"📊",label:"Notes & Suivi"},
    null,
    {id:"kahoot",icon:"🎮",label:"Kahoot"},
    {id:"tugofwar",icon:"🎯",label:"Tug of War"},
    {id:"championship",icon:"🏆",label:"Championnat"},
    null,
    {id:"xp",icon:"⭐",label:"Mon XP"},
    ...(user.role==="prof"?[null,{id:"moodle",icon:"🎓",label:"Éléa / Moodle"}]:[]),
  ];
  return (
    <div style={{width:210,background:C.surface,borderRight:`1px solid ${C.border}`,padding:"0.8rem 0",display:"flex",flexDirection:"column",gap:"0.15rem",flexShrink:0}}>
      <div style={{fontSize:"0.62rem",fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:C.muted,padding:"0.3rem 1.5rem",marginBottom:"0.2rem"}}>Menu</div>
      {items.map((item,i)=>item===null?(
        <div key={i} style={{height:1,background:C.border,margin:"0.4rem 1rem"}}/>
      ):(
        <button key={item.id} onClick={()=>setActive(item.id)} style={{display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.6rem 1rem",margin:"0 0.4rem",borderRadius:10,border:"none",background:active===item.id?"rgba(255,107,43,0.15)":"none",color:active===item.id?C.orange:C.muted,fontWeight:600,fontSize:"0.83rem",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span style={{fontSize:"1rem",minWidth:20,textAlign:"center"}}>{item.icon}</span>{item.label}
          {item.id==="xp"&&<span style={{marginLeft:"auto",background:C.xpBg,color:C.xp,borderRadius:10,padding:"0.1rem 0.4rem",fontSize:"0.65rem",fontWeight:700}}>NEW</span>}
        </button>
      ))}
    </div>
  );
}

// ── XP PAGE ───────────────────────────────────────────────────
function XPPage({user, onAddXP}) {
  const xp = user.xp || 0;
  const { current, next, progress } = getLevelInfo(xp);
  const sorted = [...STUDENTS].sort((a,b)=>b.xp-a.xp);

  return (
    <div>
      {/* Hero card */}
      <div style={{
        background:`linear-gradient(135deg, ${current.color}15, ${C.surface2})`,
        border:`1px solid ${current.color}40`, borderRadius:20,
        padding:"2rem", marginBottom:"1.5rem", position:"relative", overflow:"hidden"
      }}>
        <div style={{position:"absolute",top:-20,right:-20,fontSize:"8rem",opacity:0.06}}>{current.icon}</div>
        <div style={{display:"flex",alignItems:"center",gap:"1.5rem",flexWrap:"wrap"}}>
          <div style={{
            width:80,height:80,borderRadius:20,
            background:`linear-gradient(135deg,${current.color},${current.color}80)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:"2.5rem", flexShrink:0, boxShadow:`0 0 30px ${current.color}40`
          }}>{current.icon}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.72rem",color:C.muted,textTransform:"uppercase",letterSpacing:2,marginBottom:"0.3rem"}}>Niveau {current.level}</div>
            <div style={{fontSize:"1.8rem",fontWeight:900,color:current.color,lineHeight:1,marginBottom:"0.5rem"}}>{current.name}</div>
            <XPBadge xp={xp} size="lg"/>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"2.5rem",fontWeight:900,color:C.yellow,lineHeight:1}}>{xp}</div>
            <div style={{fontSize:"0.72rem",color:C.muted,textTransform:"uppercase",letterSpacing:1}}>XP total</div>
          </div>
        </div>
        <div style={{marginTop:"1.5rem"}}>
          <XPBar xp={xp}/>
        </div>
      </div>

      {/* All levels */}
      <Card style={{marginBottom:"1.5rem"}}>
        <SectionTitle>🗺️ Parcours de progression</SectionTitle>
        <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
          {LEVELS.map((lvl,i)=>{
            const unlocked = xp >= lvl.xpMin;
            const isCurrent = current.level === lvl.level;
            return (
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:"1rem",
                padding:"0.8rem 1rem",borderRadius:12,
                background:isCurrent?`${lvl.color}12`:unlocked?"rgba(255,255,255,0.02)":"transparent",
                border:`1px solid ${isCurrent?lvl.color+"50":unlocked?C.border:"rgba(255,255,255,0.03)"}`,
                opacity:unlocked?1:0.4
              }}>
                <div style={{
                  width:44,height:44,borderRadius:12,
                  background:unlocked?`${lvl.color}20`:"rgba(255,255,255,0.04)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:"1.5rem",flexShrink:0
                }}>{lvl.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <span style={{fontWeight:700,color:unlocked?lvl.color:C.muted}}>{lvl.name}</span>
                    {isCurrent&&<span style={{...s.badge(`${lvl.color}20`,lvl.color),fontSize:"0.6rem"}}>ACTUEL</span>}
                    {!unlocked&&<span style={{...s.badge("rgba(107,114,128,0.15)",C.muted),fontSize:"0.6rem"}}>🔒 VERROUILLÉ</span>}
                  </div>
                  <div style={{fontSize:"0.72rem",color:C.muted,marginTop:"0.1rem"}}>Niveau {lvl.level} · {lvl.xpMin} XP requis</div>
                </div>
                {unlocked&&<div style={{color:C.green,fontSize:"1.2rem"}}>✓</div>}
                {!unlocked&&<div style={{fontSize:"0.72rem",color:C.muted,textAlign:"right"}}>{lvl.xpMin - xp} XP<br/>manquants</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* XP Gains guide */}
      <Card style={{marginBottom:"1.5rem"}}>
        <SectionTitle>💡 Comment gagner des XP</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"0.6rem"}}>
          {[
            ["🎮","Kahoot — bonne réponse","+100 XP",C.blue],
            ["🏆","Kahoot — victoire finale","+300 XP",C.yellow],
            ["🎯","Tug of War — bonne réponse","+150 XP",C.orange],
            ["💪","Tug of War — victoire","+200 XP",C.red],
            ["📖","Consulter une ressource","+20 XP",C.green],
            ["🔥","Combo 3 bonnes réponses","+50 XP",C.purple],
            ["⚡","Combo 5 bonnes réponses","+150 XP",C.purple],
          ].map(([icon,label,gain,col])=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:"0.8rem",padding:"0.6rem 0.8rem",background:C.bg,borderRadius:10,border:`1px solid ${C.border}`}}>
              <span style={{fontSize:"1.2rem"}}>{icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:"0.78rem",fontWeight:600}}>{label}</div>
              </div>
              <span style={{...s.badge(`${col}20`,col),whiteSpace:"nowrap"}}>{gain}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Leaderboard */}
      <Card>
        <SectionTitle>🏆 Classement XP de la classe</SectionTitle>
        {sorted.map((st,i)=>{
          const {current:lvl}=getLevelInfo(st.xp);
          const isMe = user.role==="eleve" && st.name.startsWith(user.name[0]);
          return (
            <div key={st.name} style={{
              display:"flex",alignItems:"center",gap:"0.8rem",
              padding:"0.7rem 0.8rem",borderRadius:10,marginBottom:"0.4rem",
              background:isMe?`${lvl.color}08`:"rgba(255,255,255,0.02)",
              border:`1px solid ${isMe?lvl.color+"30":C.border}`
            }}>
              <div style={{width:28,textAlign:"center",fontWeight:900,fontSize:"0.9rem",color:i===0?C.yellow:i===1?"#94a3b8":i===2?"#cd7f32":C.muted}}>
                {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
              </div>
              <div style={{width:36,height:36,borderRadius:10,background:C.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"white",fontSize:"0.85rem",flexShrink:0}}>{st.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:"0.88rem"}}>{st.name}</div>
                <XPBadge xp={st.xp}/>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:900,color:C.yellow,fontFamily:"monospace"}}>{st.xp}</div>
                <div style={{fontSize:"0.65rem",color:C.muted}}>XP</div>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Demo button for testing */}
      {user.role==="eleve"&&(
        <div style={{marginTop:"1rem",textAlign:"center"}}>
          <Btn onClick={()=>onAddXP(100,"Test XP")} color={C.surface2} textColor={C.muted} sm>🧪 Test +100 XP</Btn>
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({user, onAddXP}){
  if(user.role==="eleve"){
    const seqs=SEQUENCES[user.classe]||[];
    const [open,setOpen]=useState(null);
    const xp = user.xp || 0;
    const {current} = getLevelInfo(xp);
    const labels={elec:"⚡ Bac Pro Électricité",cvc:"🔥 Bac Pro CVC",mis:"🔧 CAP MIS"};
    return (
      <div>
        {/* Profile card with XP */}
        <div style={{background:C.surface2,borderRadius:16,padding:"1.5rem",marginBottom:"1.5rem",border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:"1.5rem",marginBottom:"1rem"}}>
            <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg,${current.color},${current.color}80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem",flexShrink:0,boxShadow:`0 0 20px ${current.color}40`}}>
              {current.icon}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:"1.3rem",fontWeight:900}}>{user.name}</div>
              <div style={{fontSize:"0.8rem",color:C.muted,marginTop:"0.1rem"}}>{labels[user.classe]}</div>
              <div style={{display:"flex",gap:"0.4rem",marginTop:"0.6rem",flexWrap:"wrap"}}>
                <XPBadge xp={xp} size="lg"/>
                <Badge type="orange">⚡ 5 TP réalisés</Badge>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:"2rem",fontWeight:900,color:C.yellow,lineHeight:1}}>{xp}</div>
              <div style={{fontSize:"0.65rem",color:C.muted,textTransform:"uppercase"}}>XP total</div>
            </div>
          </div>
          <XPBar xp={xp}/>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"0.8rem",marginBottom:"1.5rem"}}>
          {[["14.5",C.green,"Moyenne générale"],["16",C.blue,"Meilleure note"],["87%",C.yellow,"Progression"],[`Niv.${current.level}`,current.color,"Niveau actuel"]].map(([v,col,label])=>(
            <Card key={label} style={{textAlign:"center",padding:"1rem"}}>
              <div style={{fontSize:"2rem",fontWeight:900,color:col,lineHeight:1}}>{v}</div>
              <div style={{fontSize:"0.68rem",color:C.muted,textTransform:"uppercase",letterSpacing:1,marginTop:"0.3rem"}}>{label}</div>
            </Card>
          ))}
        </div>

        {/* Sequences */}
        <Card>
          <SectionTitle>📚 Ma progression</SectionTitle>
          {seqs.map((seq,i)=>(
            <div key={i} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:"0.5rem",overflow:"hidden"}}>
              <div onClick={()=>setOpen(open===i?null:i)} style={{padding:"0.8rem 1rem",display:"flex",alignItems:"center",gap:"0.8rem",cursor:"pointer"}}>
                <div style={{fontSize:"1.4rem",fontWeight:900,color:C.orange,minWidth:36,fontFamily:"monospace"}}>{seq.num}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:"0.9rem"}}>{seq.title}</div>
                  <div style={{fontSize:"0.72rem",color:C.muted,marginTop:"0.1rem"}}>📅 {seq.periode} · {seq.semaines}</div>
                </div>
                <span style={{color:C.muted,fontSize:"0.8rem",transform:open===i?"rotate(90deg)":"none",transition:"0.2s",display:"inline-block"}}>▶</span>
              </div>
              {open===i && (
                <div style={{padding:"0 1rem 1rem"}}>
                  {seq.resources.map((r,j)=>(
                    <div key={j} onClick={()=>{if(r.s==="ok")onAddXP(XP_GAINS.resource_view,"Ressource consultée");}} style={{display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.5rem 0.8rem",borderRadius:8,marginTop:"0.4rem",background:"rgba(255,255,255,0.03)",cursor:r.s==="ok"?"pointer":"default"}}>
                      <span style={{fontSize:"1rem",minWidth:20,textAlign:"center"}}>{r.icon}</span>
                      <span style={{flex:1,fontSize:"0.82rem",fontWeight:500}}>{r.name}</span>
                      {r.s==="ok"&&<span style={{fontSize:"0.6rem",color:C.green}}>+{XP_GAINS.resource_view}XP</span>}
                      <span style={{...s.badge(r.s==="ok"?"rgba(34,211,160,0.15)":r.s==="wip"?"rgba(255,107,43,0.15)":"rgba(107,114,128,0.2)",r.s==="ok"?C.green:r.s==="wip"?C.orange:C.muted)}}>{r.s==="ok"?"Disponible":r.s==="wip"?"En cours":"Bientôt"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // PROF dashboard
  const sorted = [...STUDENTS].sort((a,b)=>b.xp-a.xp).slice(0,3);
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"1rem",marginBottom:"1.5rem"}}>
        {[["3",C.blue,"Filières actives"],["47",C.green,"Élèves connectés"],["12",C.orange,"Quiz créés"]].map(([v,col,label])=>(
          <Card key={label} style={{textAlign:"center",padding:"1.5rem"}}>
            <div style={{fontSize:"2.5rem",fontWeight:900,color:col,lineHeight:1}}>{v}</div>
            <div style={{fontSize:"0.72rem",color:C.muted,textTransform:"uppercase",letterSpacing:1,marginTop:"0.3rem"}}>{label}</div>
          </Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"1rem",marginBottom:"1rem"}}>
        <Card>
          <SectionTitle>📈 Progression par classe</SectionTitle>
          {[["⚡ Bac Pro Élec","68",C.elec],["🔥 Bac Pro CVC","52",C.cvc],["🔧 CAP MIS","75",C.mis]].map(([label,val,col])=>(
            <div key={label} style={{marginBottom:"0.8rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.8rem",marginBottom:"0.2rem"}}>
                <span>{label}</span><span style={{color:col,fontWeight:700}}>{val}%</span>
              </div>
              <Progress value={parseInt(val)} color={col}/>
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle>⭐ Top XP élèves</SectionTitle>
          {sorted.map((st,i)=>{
            const {current:lvl}=getLevelInfo(st.xp);
            return (
              <div key={st.name} style={{display:"flex",alignItems:"center",gap:"0.8rem",padding:"0.6rem 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:"1.1rem"}}>{i===0?"🥇":i===1?"🥈":"🥉"}</span>
                <div style={{width:32,height:32,borderRadius:8,background:C.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"white",fontSize:"0.8rem",flexShrink:0}}>{st.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:"0.85rem"}}>{st.name}</div>
                  <XPBadge xp={st.xp}/>
                </div>
                <div style={{fontWeight:900,color:C.yellow,fontFamily:"monospace",fontSize:"0.9rem"}}>{st.xp}</div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ── CLASSES ───────────────────────────────────────────────────
function Classes(){
  const [selected,setSelected]=useState(null);
  const [open,setOpen]=useState(null);
  const meta={elec:{label:"Bac Pro",title:"Électricité",sub:"Équipements & installations électriques",icon:"⚡",color:C.elec},cvc:{label:"Bac Pro",title:"CVC",sub:"Chauffage, Ventilation, Climatisation",icon:"🔥",color:C.cvc},mis:{label:"CAP",title:"MIS",sub:"Monteur en Installations Sanitaires",icon:"🔧",color:C.mis}};
  if(selected){
    const m=meta[selected];
    const seqs=SEQUENCES[selected];
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem",marginBottom:"1.5rem"}}>
          <Btn onClick={()=>{setSelected(null);setOpen(null)}} color={C.surface2} textColor={C.muted} sm>← Retour</Btn>
          <div style={{fontSize:"1.1rem",fontWeight:800,textTransform:"uppercase",letterSpacing:1}}>{m.icon} {m.title} — Progression annuelle</div>
        </div>
        {seqs.map((seq,i)=>(
          <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:"0.6rem",overflow:"hidden"}}>
            <div onClick={()=>setOpen(open===i?null:i)} style={{padding:"0.9rem 1.2rem",display:"flex",alignItems:"center",gap:"0.8rem",cursor:"pointer"}}>
              <div style={{fontSize:"1.5rem",fontWeight:900,color:m.color,minWidth:40,fontFamily:"monospace"}}>{seq.num}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{seq.title}</div>
                <div style={{fontSize:"0.72rem",color:C.muted,marginTop:"0.2rem"}}>📅 {seq.periode} · {seq.semaines}</div>
              </div>
              <span style={{color:C.muted,fontSize:"0.8rem",transform:open===i?"rotate(90deg)":"none",transition:"0.2s",display:"inline-block"}}>▶</span>
            </div>
            {open===i && (
              <div style={{padding:"0 1.2rem 1rem",borderTop:`1px solid ${C.border}`}}>
                {seq.resources.map((r,j)=>(
                  <div key={j} style={{display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.55rem 0.8rem",borderRadius:8,marginTop:"0.4rem",background:"rgba(255,255,255,0.03)"}}>
                    <span style={{fontSize:"1rem",minWidth:20,textAlign:"center"}}>{r.icon}</span>
                    <span style={{flex:1,fontSize:"0.82rem",fontWeight:500}}>{r.name}</span>
                    <span style={{...s.badge(r.s==="ok"?"rgba(34,211,160,0.15)":r.s==="wip"?"rgba(255,107,43,0.15)":"rgba(107,114,128,0.2)",r.s==="ok"?C.green:r.s==="wip"?C.orange:C.muted)}}>{r.s==="ok"?"Disponible":r.s==="wip"?"En cours":"Bientôt"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      <div style={{fontSize:"1.4rem",fontWeight:900,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.3rem"}}>Mes Classes</div>
      <div style={{fontSize:"0.82rem",color:C.muted,marginBottom:"1.5rem"}}>Progressions pédagogiques annuelles</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"1.2rem"}}>
        {Object.entries(meta).map(([k,m])=>(
          <div key={k} onClick={()=>setSelected(k)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",cursor:"pointer"}}>
            <div style={{padding:"1.5rem",borderBottom:`3px solid ${m.color}`,background:`linear-gradient(135deg,${m.color}10,${C.surface})`}}>
              <Badge type={k}>{m.label}</Badge>
              <div style={{fontSize:"2rem",margin:"0.5rem 0 0.3rem"}}>{m.icon}</div>
              <div style={{fontSize:"1.3rem",fontWeight:900,textTransform:"uppercase",letterSpacing:1}}>{m.title}</div>
              <div style={{fontSize:"0.75rem",color:C.muted,marginTop:"0.2rem"}}>{m.sub}</div>
            </div>
            <div style={{padding:"1rem 1.5rem"}}>
              <div style={{fontSize:"0.75rem",color:C.muted,marginBottom:"0.8rem"}}>{SEQUENCES[k].length} séquences</div>
              <Btn style={{width:"100%"}}>Voir la progression →</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NOTES ─────────────────────────────────────────────────────
function Notes(){
  const [filter,setFilter]=useState("all");
  const students=filter==="all"?STUDENTS:STUDENTS.filter(st=>st.classe===filter);
  return (
    <div>
      <div style={{fontSize:"1.4rem",fontWeight:900,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.3rem"}}>Notes & Suivi</div>
      <div style={{fontSize:"0.82rem",color:C.muted,marginBottom:"1.2rem"}}>Résultats de vos élèves par filière</div>
      <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.2rem",flexWrap:"wrap"}}>
        {[["all","Tous",C.orange],["elec","⚡ Élec",C.elec],["cvc","🔥 CVC",C.cvc],["mis","🔧 MIS",C.mis]].map(([f,label,col])=>(
          <Btn key={f} onClick={()=>setFilter(f)} color={filter===f?col:C.surface2} textColor={filter===f?"white":C.muted} sm>{label}</Btn>
        ))}
      </div>
      <Card>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.82rem"}}>
            <thead>
              <tr>{["Élève","Classe","Seq 1","Seq 2","Seq 3","XP","Niveau","Moyenne"].map(h=>(
                <th key={h} style={{background:C.bg,padding:"0.6rem 0.8rem",textAlign:"left",fontSize:"0.68rem",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:C.muted,borderBottom:`1px solid ${C.border}`}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {students.map(st=>{
                const {current}=getLevelInfo(st.xp);
                return (
                  <tr key={st.name} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"0.65rem 0.8rem",fontWeight:600}}>{st.name}</td>
                    <td style={{padding:"0.65rem 0.8rem"}}><Badge type={st.classe}>{st.classe==="elec"?"⚡ Élec":st.classe==="cvc"?"🔥 CVC":"🔧 MIS"}</Badge></td>
                    <td style={{padding:"0.65rem 0.8rem"}}><NotePill val={st.s1}/></td>
                    <td style={{padding:"0.65rem 0.8rem"}}><NotePill val={st.s2}/></td>
                    <td style={{padding:"0.65rem 0.8rem"}}><NotePill val={st.s3}/></td>
                    <td style={{padding:"0.65rem 0.8rem",fontFamily:"monospace",color:C.yellow,fontWeight:700}}>{st.xp}</td>
                    <td style={{padding:"0.65rem 0.8rem"}}><span style={{color:current.color,fontWeight:700}}>{current.icon} {current.name}</span></td>
                    <td style={{padding:"0.65rem 0.8rem"}}><NotePill val={st.avg}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── KAHOOT ────────────────────────────────────────────────────
function Kahoot({onAddXP}){
  const [mode,setMode]=useState("menu");
  const [quizzes,setQuizzes]=useState([SAMPLE_QUIZ]);
  const [playing,setPlaying]=useState(null);
  const [qIdx,setQIdx]=useState(0);
  const [chosen,setChosen]=useState(null);
  const [timer,setTimer]=useState(0);
  const [scores,setScores]=useState({});
  const [manualQs,setManualQs]=useState([{q:"",answers:["","","",""],correct:0,time:30}]);
  const [quizTitle,setQuizTitle]=useState("");
  const [quizFiliere,setQuizFiliere]=useState("elec");
  const [iaTopique,setIaTopique]=useState("");
  const [iaFiliere,setIaFiliere]=useState("elec");
  const [iaNb,setIaNb]=useState(5);
  const [courseText,setCourseText]=useState("");
  const [generated,setGenerated]=useState([]);
  const [loading,setLoading]=useState(false);
  const [combo,setCombo]=useState(0);
  const timerRef=useRef(null);
  const colors=["#e74c3c","#3498db","#2ecc71","#f39c12"];

  const startQuiz=(quiz)=>{
    const initScores={};
    STUDENTS.forEach(st=>{initScores[st.name]=0;});
    setPlaying(quiz);setQIdx(0);setChosen(null);setScores(initScores);setTimer(quiz.questions[0]?.time||30);setMode("play");setCombo(0);
  };

  useEffect(()=>{
    if(mode!=="play"||chosen!==null) return;
    timerRef.current=setInterval(()=>{
      setTimer(t=>{
        if(t<=1){clearInterval(timerRef.current);setChosen(-1);return 0;}
        return t-1;
      });
    },1000);
    return ()=>clearInterval(timerRef.current);
  },[mode,qIdx,chosen]);

  const answer=(idx)=>{
    if(chosen!==null) return;
    clearInterval(timerRef.current);
    setChosen(idx);
    const q=playing.questions[qIdx];
    if(idx===q.correct){
      const newCombo = combo + 1;
      setCombo(newCombo);
      onAddXP(XP_GAINS.kahoot_correct,"Kahoot — bonne réponse");
      if(newCombo===3) onAddXP(XP_GAINS.combo_3,"🔥 Combo x3 !");
      if(newCombo===5) onAddXP(XP_GAINS.combo_5,"⚡ Combo x5 !");
      setScores(prev=>{
        const next={...prev};
        STUDENTS.forEach(st=>{if(Math.random()>0.4)next[st.name]=(next[st.name]||0)+Math.floor(Math.random()*600+200);});
        return next;
      });
    } else {
      setCombo(0);
    }
  };

  const nextQ=()=>{
    const next=qIdx+1;
    if(next>=playing.questions.length){
      onAddXP(XP_GAINS.kahoot_win,"🏆 Quiz terminé !");
      setMode("result");
      return;
    }
    setQIdx(next);setChosen(null);setTimer(playing.questions[next]?.time||30);
  };

  const generateQuestions=async(text,fromCourse=false)=>{
    setLoading(true);
    try{
      const filiereName={elec:"électricité bâtiment",cvc:"chauffage ventilation climatisation",mis:"plomberie sanitaire"}[iaFiliere];
      const prompt=fromCourse
        ?`À partir de ce cours de lycée professionnel, génère 8 questions QCM. Réponds UNIQUEMENT en JSON valide:\n{"questions":[{"q":"?","answers":["r1","r2","r3","r4"],"correct":0,"time":20}]}\n\nCours:\n${text.slice(0,2000)}`
        :`Tu es professeur en ${filiereName}. Génère ${iaNb} questions QCM sur: "${text}". Réponds UNIQUEMENT en JSON valide:\n{"questions":[{"q":"?","answers":["r1","r2","r3","r4"],"correct":0,"time":20}]}`;
      const resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await resp.json();
      const raw=data.content.map(c=>c.text||"").join("");
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setGenerated(parsed.questions||[]);
    }catch(e){
      const fallback=TOW_QS[iaFiliere]||TOW_QS.elec;
      setGenerated(fallback.slice(0,fromCourse?6:iaNb).map(q=>({q:q.q,answers:[q.a,"Mauvaise réponse B","Mauvaise réponse C","Mauvaise réponse D"],correct:0,time:20})));
    }
    setLoading(false);
  };

  if(mode==="play"&&playing){
    const q=playing.questions[qIdx];
    const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,5);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem",marginBottom:"1.2rem"}}>
          <Btn onClick={()=>{clearInterval(timerRef.current);setMode("menu");}} color={C.surface2} textColor={C.muted} sm>✕ Stop</Btn>
          <div style={{fontWeight:800,fontSize:"1rem",textTransform:"uppercase",flex:1}}>{playing.title}</div>
          {combo>=2&&<span style={{...s.badge("rgba(255,107,43,0.2)",C.orange)}}>🔥 Combo x{combo}</span>}
          <div style={{fontSize:"0.8rem",color:C.muted}}>Q {qIdx+1}/{playing.questions.length}</div>
        </div>
        <div style={{background:C.surface2,borderRadius:16,padding:"2rem",textAlign:"center",marginBottom:"1.5rem",border:`1px solid ${C.border}`}}>
          <div style={{fontSize:"1.2rem",fontWeight:700,marginBottom:"0.8rem",lineHeight:1.3}}>{q.q}</div>
          <div style={{fontSize:"3rem",fontWeight:900,color:timer<=5?C.red:timer<=10?C.yellow:C.orange,fontFamily:"monospace"}}>{timer}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.8rem",marginBottom:"1rem"}}>
          {(q.answers||[]).map((a,i)=>(
            <button key={i} onClick={()=>answer(i)} disabled={chosen!==null} style={{padding:"1rem",borderRadius:12,border:"none",background:chosen===null?colors[i]:i===q.correct?"#27ae60":i===chosen?"#c0392b":colors[i],color:"white",fontFamily:"inherit",fontSize:"0.95rem",fontWeight:700,cursor:chosen===null?"pointer":"default",opacity:chosen!==null&&i!==q.correct&&i!==chosen?0.4:1,outline:i===q.correct&&chosen!==null?`3px solid ${C.green}`:"none",transition:"all 0.2s"}}>
              {a}
            </button>
          ))}
        </div>
        {chosen!==null&&(
          <>
            <div style={{textAlign:"center",padding:"0.8rem",borderRadius:10,background:chosen===q.correct?"rgba(34,211,160,0.15)":"rgba(255,77,109,0.15)",color:chosen===q.correct?C.green:C.red,fontWeight:700,marginBottom:"0.5rem"}}>
              {chosen===q.correct?`✅ Correct ! +${XP_GAINS.kahoot_correct} XP`:"❌ Incorrect — bonne réponse : "+q.answers[q.correct]}
            </div>
            {combo>=3&&chosen===q.correct&&<div style={{textAlign:"center",padding:"0.4rem",borderRadius:8,background:"rgba(255,107,43,0.1)",color:C.orange,fontWeight:700,fontSize:"0.85rem",marginBottom:"0.5rem"}}>🔥 Combo x{combo} ! Bonus XP !</div>}
            <div style={{background:C.surface2,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
              <div style={{fontWeight:700,textTransform:"uppercase",fontSize:"0.8rem",marginBottom:"0.6rem"}}>🏆 Scores</div>
              {sorted.map(([name,pts],i)=>(
                <div key={name} style={{display:"flex",alignItems:"center",gap:"0.8rem",padding:"0.4rem 0",borderBottom:`1px solid ${C.border}`,fontSize:"0.85rem"}}>
                  <span style={{fontFamily:"monospace",color:C.orange,minWidth:24}}>{i+1}</span>
                  <span style={{flex:1,fontWeight:600}}>{name}</span>
                  <span style={{fontFamily:"monospace",color:C.yellow}}>{pts} pts</span>
                </div>
              ))}
            </div>
            <div style={{textAlign:"center"}}>
              <Btn onClick={nextQ}>{qIdx+1<playing.questions.length?"Question suivante →":"Terminer 🏆"}</Btn>
            </div>
          </>
        )}
      </div>
    );
  }

  if(mode==="result"){
    const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    return (
      <div style={{textAlign:"center",padding:"2rem"}}>
        <div style={{fontSize:"3rem",marginBottom:"0.5rem"}}>🏆</div>
        <div style={{fontSize:"1.5rem",fontWeight:900,marginBottom:"0.5rem"}}>Quiz terminé !</div>
        <div style={{background:C.xpBg,border:`1px solid ${C.yellow}30`,borderRadius:12,padding:"0.8rem",marginBottom:"1.5rem",color:C.yellow,fontWeight:700}}>
          ⭐ +{XP_GAINS.kahoot_win} XP bonus pour avoir terminé !
        </div>
        <Card style={{textAlign:"left",maxWidth:400,margin:"0 auto 1.5rem"}}>
          <SectionTitle>Classement final</SectionTitle>
          {sorted.map(([name,pts],i)=>(
            <div key={name} style={{display:"flex",alignItems:"center",gap:"0.8rem",padding:"0.5rem 0",borderBottom:`1px solid ${C.border}`,fontSize:"0.88rem"}}>
              <span style={{fontFamily:"monospace",fontSize:"1.1rem",color:C.yellow,minWidth:28}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
              <span style={{flex:1,fontWeight:600}}>{name}</span>
              <span style={{fontFamily:"monospace",color:C.yellow}}>{pts} pts</span>
            </div>
          ))}
        </Card>
        <Btn onClick={()=>setMode("menu")}>← Retour aux quiz</Btn>
      </div>
    );
  }

  if(mode==="manual"){
    const addQ=()=>setManualQs(prev=>[...prev,{q:"",answers:["","","",""],correct:0,time:30}]);
    const updQ=(i,field,val)=>setManualQs(prev=>prev.map((q,qi)=>qi===i?{...q,[field]:val}:q));
    const updAns=(qi,ai,val)=>setManualQs(prev=>prev.map((q,i)=>i===qi?{...q,answers:q.answers.map((a,j)=>j===ai?val:a)}:q));
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem",marginBottom:"1.2rem"}}>
          <Btn onClick={()=>setMode("menu")} color={C.surface2} textColor={C.muted} sm>← Retour</Btn>
          <div style={{fontWeight:800,textTransform:"uppercase"}}>✏️ Créer un quiz</div>
        </div>
        <Card style={{marginBottom:"1rem"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.8rem"}}>
            <div><div style={{fontSize:"0.72rem",color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.3rem"}}>Titre</div><input style={s.input} placeholder="Titre du quiz..." value={quizTitle} onChange={e=>setQuizTitle(e.target.value)}/></div>
            <div><div style={{fontSize:"0.72rem",color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.3rem"}}>Filière</div>
              <select style={s.input} value={quizFiliere} onChange={e=>setQuizFiliere(e.target.value)}>
                <option value="elec">⚡ Bac Pro Électricité</option><option value="cvc">🔥 Bac Pro CVC</option><option value="mis">🔧 CAP MIS</option>
              </select>
            </div>
          </div>
        </Card>
        {manualQs.map((mq,qi)=>(
          <Card key={qi} style={{marginBottom:"0.8rem"}}>
            <div style={{fontSize:"0.72rem",fontWeight:700,color:C.orange,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.6rem"}}>Question {qi+1}</div>
            <input style={{...s.input,marginBottom:"0.6rem"}} placeholder="Tapez votre question..." value={mq.q} onChange={e=>updQ(qi,"q",e.target.value)}/>
            <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.6rem",alignItems:"center"}}>
              <span style={{fontSize:"0.72rem",color:C.muted}}>Temps:</span>
              {[15,20,30,45,60].map(t=><Btn key={t} onClick={()=>updQ(qi,"time",t)} color={mq.time===t?C.orange:C.surface2} textColor={mq.time===t?"white":C.muted} sm>{t}s</Btn>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
              {mq.answers.map((a,ai)=>(
                <div key={ai} style={{display:"flex",alignItems:"center",gap:"0.5rem",background:C.surface2,border:`1px solid ${mq.correct===ai?colors[ai]:C.border}`,borderRadius:8,padding:"0.4rem 0.6rem"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:colors[ai],flexShrink:0}}/>
                  <input style={{flex:1,background:"none",border:"none",color:C.text,fontSize:"0.82rem",outline:"none",fontFamily:"inherit"}} placeholder={`Réponse ${["A","B","C","D"][ai]}`} value={a} onChange={e=>updAns(qi,ai,e.target.value)}/>
                  <button onClick={()=>updQ(qi,"correct",ai)} style={{background:"none",border:"none",cursor:"pointer",color:mq.correct===ai?C.green:C.muted,fontSize:"1rem"}}>✓</button>
                </div>
              ))}
            </div>
          </Card>
        ))}
        <div style={{display:"flex",gap:"0.6rem",flexWrap:"wrap"}}>
          <Btn onClick={addQ} color={C.surface2} textColor={C.muted}>+ Ajouter question</Btn>
          <Btn onClick={()=>{const q={id:Date.now(),title:quizTitle||"Quiz sans titre",filiere:quizFiliere,questions:manualQs.filter(q=>q.q.trim())};setQuizzes(p=>[...p,q]);startQuiz(q);}}>💾 Sauver & Lancer</Btn>
          <Btn onClick={()=>{const q={id:Date.now(),title:quizTitle||"Quiz sans titre",filiere:quizFiliere,questions:manualQs.filter(q=>q.q.trim())};setQuizzes(p=>[...p,q]);setMode("menu");}} color={C.surface2} textColor={C.muted}>💾 Sauver seulement</Btn>
        </div>
      </div>
    );
  }

  if(mode==="ia"){
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem",marginBottom:"1.2rem"}}>
          <Btn onClick={()=>setMode("menu")} color={C.surface2} textColor={C.muted} sm>← Retour</Btn>
          <div style={{fontWeight:800,textTransform:"uppercase"}}>🤖 Génération IA</div>
        </div>
        <div style={{background:"linear-gradient(135deg,rgba(167,139,250,0.08),rgba(255,107,43,0.05))",border:"1px solid rgba(167,139,250,0.2)",borderRadius:14,padding:"1.5rem",marginBottom:"1rem"}}>
          <div style={{color:C.purple,fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:"1rem"}}>🤖 L'IA génère vos questions</div>
          <div style={{marginBottom:"0.8rem"}}>
            <div style={{fontSize:"0.72rem",color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.4rem"}}>Filière</div>
            <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
              {[["elec","⚡ Électricité"],["cvc","🔥 CVC"],["mis","🔧 MIS"]].map(([k,label])=>(
                <button key={k} onClick={()=>setIaFiliere(k)} style={{padding:"0.4rem 0.9rem",background:iaFiliere===k?"rgba(167,139,250,0.2)":C.surface2,border:`1px solid ${iaFiliere===k?"rgba(167,139,250,0.5)":C.border}`,borderRadius:20,fontSize:"0.78rem",fontWeight:600,color:iaFiliere===k?C.purple:C.muted,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:"0.8rem"}}>
            <div style={{fontSize:"0.72rem",color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.4rem"}}>Sujet</div>
            <input style={s.input} placeholder="Ex: Protection des personnes, disjoncteurs..." value={iaTopique} onChange={e=>setIaTopique(e.target.value)}/>
          </div>
          <div style={{marginBottom:"1rem"}}>
            <div style={{fontSize:"0.72rem",color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.4rem"}}>Nombre</div>
            <div style={{display:"flex",gap:"0.4rem"}}>
              {[5,10,15].map(n=><Btn key={n} onClick={()=>setIaNb(n)} color={iaNb===n?C.purple:C.surface2} textColor={iaNb===n?"white":C.muted} sm>{n} questions</Btn>)}
            </div>
          </div>
          <Btn onClick={()=>generateQuestions(iaTopique)} color={C.purple} style={{opacity:loading?0.6:1}}>
            {loading?"⏳ Génération...":"🤖 Générer les questions"}
          </Btn>
        </div>
        {generated.length>0&&(
          <>
            {generated.map((q,i)=>(
              <Card key={i} style={{marginBottom:"0.6rem"}}>
                <div style={{fontSize:"0.72rem",color:C.purple,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.4rem"}}>Q{i+1} · {q.time}s</div>
                <div style={{fontWeight:600,marginBottom:"0.6rem"}}>{q.q}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem"}}>
                  {(q.answers||[]).map((a,ai)=>(
                    <div key={ai} style={{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.4rem 0.6rem",borderRadius:6,background:ai===q.correct?"rgba(34,211,160,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${ai===q.correct?"rgba(34,211,160,0.3)":C.border}`}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:colors[ai],flexShrink:0}}/>
                      <span style={{fontSize:"0.8rem"}}>{a}</span>
                      {ai===q.correct&&<span style={{marginLeft:"auto",color:C.green,fontSize:"0.75rem"}}>✓</span>}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <div style={{display:"flex",gap:"0.6rem",marginTop:"1rem"}}>
              <Btn onClick={()=>{const q={id:Date.now(),title:`Quiz IA — ${iaFiliere}`,filiere:iaFiliere,questions:generated};setQuizzes(p=>[...p,q]);startQuiz(q);}}>🚀 Lancer</Btn>
              <Btn onClick={()=>{setQuizzes(p=>[...p,{id:Date.now(),title:`Quiz IA — ${iaFiliere}`,filiere:iaFiliere,questions:generated}]);setMode("menu");}} color={C.surface2} textColor={C.muted}>💾 Sauvegarder</Btn>
            </div>
          </>
        )}
      </div>
    );
  }

  if(mode==="pdf"){
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem",marginBottom:"1.2rem"}}>
          <Btn onClick={()=>setMode("menu")} color={C.surface2} textColor={C.muted} sm>← Retour</Btn>
          <div style={{fontWeight:800,textTransform:"uppercase"}}>📄 Quiz depuis votre cours</div>
        </div>
        <Card>
          <div style={{color:C.green,fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.8rem"}}>📄 Collez votre cours ici</div>
          <textarea style={{...s.input,height:160,resize:"vertical"}} placeholder="Collez le texte de votre cours ici... L'IA va générer des questions automatiquement !" value={courseText} onChange={e=>setCourseText(e.target.value)}/>
          <div style={{marginTop:"0.8rem"}}>
            <Btn onClick={()=>generateQuestions(courseText,true)} color={C.green} style={{color:"#0d0f14",opacity:loading?0.6:1}}>
              {loading?"⏳ Génération...":"🤖 Extraire les questions"}
            </Btn>
          </div>
        </Card>
        {generated.length>0&&(
          <>
            <div style={{margin:"1rem 0 0.5rem",fontWeight:700}}>✅ {generated.length} questions générées</div>
            {generated.map((q,i)=>(
              <Card key={i} style={{marginBottom:"0.6rem"}}>
                <div style={{fontWeight:600,marginBottom:"0.5rem"}}>{i+1}. {q.q}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.3rem"}}>
                  {(q.answers||[]).map((a,ai)=><div key={ai} style={{fontSize:"0.8rem",padding:"0.3rem 0.5rem",borderRadius:5,background:ai===q.correct?"rgba(34,211,160,0.1)":"rgba(255,255,255,0.03)",color:ai===q.correct?C.green:C.text}}>{["A","B","C","D"][ai]}. {a}</div>)}
                </div>
              </Card>
            ))}
            <div style={{display:"flex",gap:"0.6rem",marginTop:"1rem"}}>
              <Btn onClick={()=>{const q={id:Date.now(),title:"Quiz depuis cours",filiere:"elec",questions:generated};setQuizzes(p=>[...p,q]);startQuiz(q);}}>🚀 Lancer</Btn>
              <Btn onClick={()=>{setQuizzes(p=>[...p,{id:Date.now(),title:"Quiz depuis cours",filiere:"elec",questions:generated}]);setMode("menu");}} color={C.surface2} textColor={C.muted}>💾 Sauvegarder</Btn>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{fontSize:"1.4rem",fontWeight:900,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.3rem"}}>🎮 Kahoot</div>
      <div style={{fontSize:"0.82rem",color:C.muted,marginBottom:"0.8rem"}}>Créez et lancez des quiz interactifs</div>
      <div style={{background:C.xpBg,border:`1px solid ${C.yellow}30`,borderRadius:10,padding:"0.6rem 1rem",marginBottom:"1.2rem",fontSize:"0.8rem",color:C.yellow,fontWeight:600}}>
        ⭐ Gains XP : +{XP_GAINS.kahoot_correct} XP par bonne réponse · +{XP_GAINS.kahoot_win} XP à la fin · Bonus combo !
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem",marginBottom:"2rem"}}>
        {[["✏️","Manuel","Tapez vos propres questions","manual",C.orange],["🤖","IA","L'IA génère les questions","ia",C.purple],["📄","Depuis cours","Collez votre cours","pdf",C.green]].map(([icon,title,sub,m,col])=>(
          <div key={m} onClick={()=>setMode(m)} style={{background:C.surface,border:`1px solid ${col}30`,borderRadius:14,padding:"1.5rem",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:"2.2rem",marginBottom:"0.5rem"}}>{icon}</div>
            <div style={{fontWeight:800,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"0.3rem",color:col}}>{title}</div>
            <div style={{fontSize:"0.78rem",color:C.muted}}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.8rem"}}>
        <div style={{fontWeight:800,textTransform:"uppercase",letterSpacing:1}}>📋 Quiz sauvegardés</div>
        <Btn onClick={()=>setMode("manual")} sm>+ Nouveau</Btn>
      </div>
      {quizzes.map(q=>(
        <Card key={q.id} style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"0.6rem"}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700}}>{q.title}</div>
            <div style={{fontSize:"0.72rem",color:C.muted,marginTop:"0.2rem"}}><Badge type={q.filiere}>{q.filiere==="elec"?"⚡ Élec":q.filiere==="cvc"?"🔥 CVC":"🔧 MIS"}</Badge> · {q.questions.length} questions</div>
          </div>
          <Btn onClick={()=>startQuiz(q)} sm>▶ Lancer</Btn>
        </Card>
      ))}
    </div>
  );
}

// ── TUG OF WAR ────────────────────────────────────────────────
function TugOfWar({onAddXP}){
  const [phase,setPhase]=useState("setup");
  const [teamA,setTeamA]=useState("Équipe Bleue");
  const [teamB,setTeamB]=useState("Équipe Rouge");
  const [filiere,setFiliere]=useState("elec");
  const [questions,setQuestions]=useState(TOW_QS.elec.map(q=>({...q})));
  const [qIdx,setQIdx]=useState(0);
  const [scoreA,setScoreA]=useState(0);
  const [scoreB,setScoreB]=useState(0);
  const [ropePos,setRopePos]=useState(50);
  const [ansA,setAnsA]=useState("");
  const [ansB,setAnsB]=useState("");
  const [result,setResult]=useState(null);

  const addQ=()=>setQuestions(p=>[...p,{q:"",a:""}]);
  const updQ=(i,field,val)=>setQuestions(p=>p.map((q,qi)=>qi===i?{...q,[field]:val}:q));
  const loadFiliere=(f)=>{setFiliere(f);setQuestions(TOW_QS[f].map(q=>({...q})));};

  const start=()=>{
    const valid=questions.filter(q=>q.q.trim()&&q.a.trim());
    if(!valid.length){alert("Ajoutez au moins une question !");return;}
    setQuestions(valid);setQIdx(0);setScoreA(0);setScoreB(0);setRopePos(50);setAnsA("");setAnsB("");setResult(null);setPhase("play");
  };

  const check=(team)=>{
    const q=questions[qIdx];
    const ans=team==="a"?ansA.trim().toLowerCase():ansB.trim().toLowerCase();
    const correct=q.a.toLowerCase();
    const ok=ans===correct||ans.includes(correct)||correct.includes(ans);
    if(ok){
      onAddXP(XP_GAINS.tug_correct,"Tug of War — bonne réponse");
      if(team==="a"){setScoreA(sc=>sc+1);setRopePos(p=>Math.max(10,p-15));setResult({winner:teamA,answer:q.a});}
      else{setScoreB(sc=>sc+1);setRopePos(p=>Math.min(90,p+15));setResult({winner:teamB,answer:q.a});}
    }else{
      setResult({winner:null,answer:q.a});
    }
  };

  const nextQ=()=>{
    const next=qIdx+1;
    if(next>=questions.length){setPhase("end");return;}
    setQIdx(next);setAnsA("");setAnsB("");setResult(null);
  };

  if(phase==="end"){
    const winner = scoreA===scoreB?null:scoreA>scoreB?teamA:teamB;
    if(winner) onAddXP(XP_GAINS.tug_win,"🏆 Tug of War — victoire !");
    return (
      <div style={{textAlign:"center",padding:"2rem"}}>
        <div style={{fontSize:"3rem",marginBottom:"0.5rem"}}>🎉</div>
        <div style={{fontSize:"1.5rem",fontWeight:900,marginBottom:"0.5rem"}}>Fin du match !</div>
        <div style={{fontSize:"1.1rem",color:C.yellow,fontWeight:700,marginBottom:"1rem"}}>{scoreA===scoreB?"🤝 Égalité !":scoreA>scoreB?`🏆 Vainqueur : ${teamA}`:`🏆 Vainqueur : ${teamB}`}</div>
        {winner&&<div style={{background:C.xpBg,border:`1px solid ${C.yellow}30`,borderRadius:10,padding:"0.6rem 1rem",marginBottom:"1.5rem",color:C.yellow,fontWeight:700,fontSize:"0.85rem"}}>⭐ +{XP_GAINS.tug_win} XP pour la victoire !</div>}
        <div style={{display:"flex",justifyContent:"center",gap:"3rem",marginBottom:"2rem"}}>
          <div><div style={{fontSize:"2.5rem",fontWeight:900,color:C.blue}}>{scoreA}</div><div style={{fontSize:"0.8rem",color:C.muted}}>{teamA}</div></div>
          <div style={{color:C.muted,fontSize:"1.5rem",paddingTop:"0.5rem"}}>VS</div>
          <div><div style={{fontSize:"2.5rem",fontWeight:900,color:C.red}}>{scoreB}</div><div style={{fontSize:"0.8rem",color:C.muted}}>{teamB}</div></div>
        </div>
        <Btn onClick={()=>{setPhase("setup");setQuestions(TOW_QS[filiere].map(q=>({...q})));}}>← Rejouer</Btn>
      </div>
    );
  }

  if(phase==="play"){
    const q=questions[qIdx];
    return (
      <div>
        <div style={{background:"linear-gradient(180deg,#0a1628,#0d1f3c 50%,#1a0a0a)",borderRadius:16,padding:"1.5rem",marginBottom:"1rem",border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.2rem"}}>
            <div style={{textAlign:"center",flex:1}}>
              <div style={{fontWeight:900,textTransform:"uppercase",letterSpacing:1,color:C.blue}}>{teamA}</div>
              <div style={{fontSize:"2.5rem",fontFamily:"monospace",color:C.blue,lineHeight:1}}>{scoreA}</div>
            </div>
            <div style={{textAlign:"center",fontSize:"0.75rem",color:C.muted,textTransform:"uppercase"}}>VS</div>
            <div style={{textAlign:"center",flex:1}}>
              <div style={{fontWeight:900,textTransform:"uppercase",letterSpacing:1,color:C.red}}>{teamB}</div>
              <div style={{fontSize:"2.5rem",fontFamily:"monospace",color:C.red,lineHeight:1}}>{scoreB}</div>
            </div>
          </div>
          <div style={{position:"relative",height:50,margin:"0.5rem 0"}}>
            <div style={{position:"absolute",top:"50%",left:"10%",right:"10%",height:8,background:"repeating-linear-gradient(90deg,#8b6914 0px,#c9961e 4px,#8b6914 8px)",transform:"translateY(-50%)",borderRadius:4}}/>
            <div style={{position:"absolute",top:"50%",left:`${ropePos}%`,transform:"translate(-50%,-50%)",width:20,height:20,background:"white",borderRadius:"50%",border:"3px solid #333",zIndex:2,transition:"left 0.4s ease"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"0 5%",fontSize:"2.5rem"}}>
            <span>🏋️</span><span style={{transform:"scaleX(-1)",display:"inline-block"}}>🏋️</span>
          </div>
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"1.2rem",textAlign:"center",marginBottom:"1rem",border:`1px solid ${C.border}`}}>
          <div style={{fontSize:"1.1rem",fontWeight:700,marginBottom:"0.3rem"}}>{q.q}</div>
          <div style={{fontSize:"0.75rem",color:C.muted}}>Question {qIdx+1}/{questions.length} · <span style={{color:C.green}}>+{XP_GAINS.tug_correct} XP si correct</span></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
          {[["a",teamA,C.blue,ansA,setAnsA],["b",teamB,C.red,ansB,setAnsB]].map(([team,name,col,val,setVal])=>(
            <div key={team} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"1rem",textAlign:"center"}}>
              <div style={{fontSize:"0.72rem",fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:col,marginBottom:"0.5rem"}}>{name}</div>
              <input style={{...s.input,textAlign:"center",fontSize:"1rem",borderColor:col+"60",marginBottom:"0.5rem"}} placeholder="Réponse..." value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!result)check(team);}}/>
              <Btn onClick={()=>{if(!result)check(team);}} color={col} style={{width:"100%"}} sm>Valider ✓</Btn>
            </div>
          ))}
        </div>
        {result&&(
          <>
            <div style={{textAlign:"center",padding:"0.8rem",borderRadius:10,background:result.winner?"rgba(34,211,160,0.1)":"rgba(107,114,128,0.1)",color:result.winner?C.green:C.muted,fontWeight:700,marginBottom:"0.8rem",fontSize:"1rem"}}>
              {result.winner?`✅ ${result.winner} — +${XP_GAINS.tug_correct} XP !`:`❌ Incorrect !`} — Réponse : <strong>{result.answer}</strong>
            </div>
            <div style={{textAlign:"center"}}>
              <Btn onClick={nextQ}>{qIdx+1<questions.length?"Question suivante →":"Voir le résultat 🏆"}</Btn>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{fontSize:"1.4rem",fontWeight:900,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.3rem"}}>🎯 Tug of War</div>
      <div style={{fontSize:"0.82rem",color:C.muted,marginBottom:"0.8rem"}}>Le tir à la corde pédagogique</div>
      <div style={{background:C.xpBg,border:`1px solid ${C.yellow}30`,borderRadius:10,padding:"0.6rem 1rem",marginBottom:"1.2rem",fontSize:"0.8rem",color:C.yellow,fontWeight:600}}>
        ⭐ +{XP_GAINS.tug_correct} XP par bonne réponse · +{XP_GAINS.tug_win} XP pour la victoire
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1.2rem"}}>
        {[["a","Équipe Bleue",C.blue,teamA,setTeamA],["b","Équipe Rouge",C.red,teamB,setTeamB]].map(([t,placeholder,col,val,setVal])=>(
          <Card key={t}>
            <div style={{fontSize:"0.9rem",fontWeight:800,textTransform:"uppercase",color:col,marginBottom:"0.6rem"}}>Équipe {t.toUpperCase()}</div>
            <input style={s.input} placeholder={placeholder} value={val} onChange={e=>setVal(e.target.value)}/>
          </Card>
        ))}
      </div>
      <Card style={{marginBottom:"1.2rem"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.8rem"}}>
          <SectionTitle>❓ Questions</SectionTitle>
          <div style={{display:"flex",gap:"0.4rem"}}>
            {[["elec","⚡"],["cvc","🔥"],["mis","🔧"]].map(([k,icon])=><Btn key={k} onClick={()=>loadFiliere(k)} color={filiere===k?C.orange:C.surface2} textColor={filiere===k?"white":C.muted} sm>{icon} {k.toUpperCase()}</Btn>)}
          </div>
        </div>
        {questions.map((q,i)=>(
          <div key={i} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"0.8rem",marginBottom:"0.5rem"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
              <input style={s.input} placeholder="Question..." value={q.q} onChange={e=>updQ(i,"q",e.target.value)}/>
              <input style={s.input} placeholder="Bonne réponse..." value={q.a} onChange={e=>updQ(i,"a",e.target.value)}/>
            </div>
          </div>
        ))}
        <Btn onClick={addQ} color={C.surface2} textColor={C.muted} sm>+ Ajouter une question</Btn>
      </Card>
      <Btn onClick={start} style={{fontSize:"1rem",padding:"0.8rem 2rem"}}>🎯 Lancer le jeu !</Btn>
    </div>
  );
}

// ── CHAMPIONSHIP ──────────────────────────────────────────────
function Championship(){
  const sorted=[...STUDENTS].sort((a,b)=>b.xp-a.xp);
  const champ=[
    {rank:1,name:"Amara D.",classe:"elec",k:[950,1100,900,1200],total:4150},
    {rank:2,name:"Youssef M.",classe:"elec",k:[800,900,850,870],total:3420},
    {rank:3,name:"Kevin T.",classe:"cvc",k:[700,750,720,720],total:2890},
    {rank:4,name:"Saliou B.",classe:"mis",k:[600,700,650,600],total:2550},
    {rank:5,name:"Fatou N.",classe:"cvc",k:[500,600,550,500],total:2150},
  ];
  const [tab,setTab]=useState("xp");
  return (
    <div>
      <div style={{fontSize:"1.4rem",fontWeight:900,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.3rem"}}>🏆 Championnat</div>
      <div style={{fontSize:"0.82rem",color:C.muted,marginBottom:"1.2rem"}}>Classement général</div>
      <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.2rem"}}>
        <Btn onClick={()=>setTab("xp")} color={tab==="xp"?C.yellow:C.surface2} textColor={tab==="xp"?"#0d0f14":C.muted} sm>⭐ Classement XP</Btn>
        <Btn onClick={()=>setTab("kahoot")} color={tab==="kahoot"?C.orange:C.surface2} textColor={tab==="kahoot"?"white":C.muted} sm>🎮 Classement Kahoot</Btn>
      </div>

      {tab==="xp"&&(
        <>
          {/* Podium XP */}
          <Card style={{marginBottom:"1rem"}}>
            <SectionTitle>⭐ Podium XP</SectionTitle>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:"0.5rem",margin:"1rem 0"}}>
              {[sorted[1],sorted[0],sorted[2]].map((st,i)=>{
                if(!st)return null;
                const {current}=getLevelInfo(st.xp);
                const heights=[65,85,55];
                const medals=["🥈","🥇","🥉"];
                return (
                  <div key={st.name} style={{textAlign:"center",padding:"0.8rem 1rem",borderRadius:"10px 10px 0 0",background:`${current.color}12`,minHeight:heights[i],display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",border:`1px solid ${current.color}30`}}>
                    <div style={{fontSize:"1.5rem"}}>{medals[i]}</div>
                    <div style={{fontSize:"0.78rem",fontWeight:700,marginTop:"0.2rem"}}>{st.name}</div>
                    <div style={{fontSize:"0.65rem",color:C.yellow,fontWeight:700}}>{st.xp} XP</div>
                    <XPBadge xp={st.xp}/>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <SectionTitle>📋 Classement XP complet</SectionTitle>
            {sorted.map((st,i)=>{
              const {current}=getLevelInfo(st.xp);
              return (
                <div key={st.name} style={{display:"flex",alignItems:"center",gap:"0.8rem",padding:"0.6rem 0.8rem",borderRadius:10,marginBottom:"0.4rem",background:"rgba(255,255,255,0.02)",border:`1px solid ${C.border}`}}>
                  <div style={{width:28,textAlign:"center",fontWeight:900,color:i===0?C.yellow:i===1?"#94a3b8":i===2?"#cd7f32":C.muted}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
                  <div style={{width:36,height:36,borderRadius:10,background:C.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"white",fontSize:"0.85rem",flexShrink:0}}>{st.name[0]}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:"0.88rem"}}>{st.name}</div>
                    <XPBadge xp={st.xp}/>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:900,color:C.yellow,fontFamily:"monospace"}}>{st.xp}</div>
                    <div style={{fontSize:"0.65rem",color:C.muted}}>XP</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {tab==="kahoot"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"1rem",marginBottom:"1.5rem"}}>
            {[["4/10",C.yellow,"Kahoots joués"],["18",C.green,"Participants"],["6",C.purple,"Kahoots restants"]].map(([v,col,label])=>(
              <Card key={label} style={{textAlign:"center",padding:"1.2rem"}}>
                <div style={{fontSize:"2rem",fontWeight:900,color:col,lineHeight:1}}>{v}</div>
                <div style={{fontSize:"0.68rem",color:C.muted,textTransform:"uppercase",letterSpacing:1,marginTop:"0.3rem"}}>{label}</div>
              </Card>
            ))}
          </div>
          <Card>
            <SectionTitle>📋 Classement Kahoot</SectionTitle>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.82rem"}}>
                <thead>
                  <tr>{["#","Élève","Classe","K1","K2","K3","K4","Total"].map(h=><th key={h} style={{background:C.bg,padding:"0.6rem 0.8rem",textAlign:"left",fontSize:"0.68rem",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:C.muted,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {champ.map(st=>(
                    <tr key={st.name} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"0.6rem 0.8rem",color:C.yellow,fontWeight:700}}>{st.rank===1?"🥇":st.rank===2?"🥈":st.rank===3?"🥉":st.rank}</td>
                      <td style={{padding:"0.6rem 0.8rem",fontWeight:600}}>{st.name}</td>
                      <td style={{padding:"0.6rem 0.8rem"}}><Badge type={st.classe}>{st.classe==="elec"?"⚡ Élec":st.classe==="cvc"?"🔥 CVC":"🔧 MIS"}</Badge></td>
                      {st.k.map((k,i)=><td key={i} style={{padding:"0.6rem 0.8rem",fontFamily:"monospace",fontSize:"0.8rem"}}>{k}</td>)}
                      <td style={{padding:"0.6rem 0.8rem",fontFamily:"monospace",fontWeight:700,color:C.yellow}}>{st.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── MOODLE ────────────────────────────────────────────────────
function Moodle(){
  return (
    <div>
      <div style={{fontSize:"1.4rem",fontWeight:900,textTransform:"uppercase",letterSpacing:1,marginBottom:"1.5rem"}}>🎓 Éléa — Moodle</div>
      {[
        {color:C.blue,title:"🎓 Qu'est-ce qu'Éléa ?",content:"Éléa est la plateforme Moodle officielle de l'Éducation Nationale. En tant qu'enseignant à l'académie de Versailles, vous avez droit à un espace gratuit avec suivi des élèves, dépôt de fichiers, quiz et forums."},
        {color:C.green,title:"✅ Comment obtenir votre espace",steps:["Connectez-vous sur elea.ac-versailles.fr avec vos identifiants académiques","Si pas d'accès → contactez votre référent numérique ou chef d'établissement","Formation gratuite disponible via la DANE de Versailles","Une fois créé → transférez toutes vos ressources depuis ce site"]},
        {color:C.yellow,title:"💡 En attendant Moodle",content:"Ce site fonctionne déjà ! Partagez-le à vos élèves via un simple lien. Accessible depuis n'importe quel téléphone ou ordinateur, sans installation."},
      ].map(({color,title,content,steps})=>(
        <div key={title} style={{background:`${color}10`,border:`1px solid ${color}30`,borderRadius:12,padding:"1.5rem",marginBottom:"1rem"}}>
          <div style={{color,fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:"0.8rem"}}>{title}</div>
          {content&&<p style={{fontSize:"0.85rem",color:C.muted,lineHeight:1.6}}>{content}</p>}
          {steps&&<div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>{steps.map((step,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.8rem",fontSize:"0.83rem"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:`${color}20`,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",fontWeight:700,flexShrink:0}}>{i+1}</div>
              <span style={{color:C.text,lineHeight:1.5}}>{step}</span>
            </div>
          ))}</div>}
        </div>
      ))}
    </div>
  );
}

// ── APP SHELL ─────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(null);
  const [active,setActive]=useState("dashboard");
  const [toasts,setToasts]=useState([]);
  const [levelUp,setLevelUp]=useState(null);

  const addXP = (gain, label) => {
    if(!user || user.role==="prof") return;
    const oldXP = user.xp || 0;
    const newXP = oldXP + gain;
    const oldLevel = getLevelInfo(oldXP).current.level;
    const newLevel = getLevelInfo(newXP).current.level;

    setUser(prev => ({...prev, xp: newXP}));

    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, {id, gain, label}]);

    if(newLevel > oldLevel) {
      const lvlInfo = getLevelInfo(newXP).current;
      setTimeout(() => setLevelUp(lvlInfo), 600);
    }
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  if(!user) return <Login onLogin={u=>{setUser({...u, xp: u.xp||420});setActive("dashboard");}}/>;

  const panels={
    dashboard:<Dashboard user={user} onAddXP={addXP}/>,
    classes:<Classes/>,
    notes:<Notes/>,
    kahoot:<Kahoot onAddXP={addXP}/>,
    tugofwar:<TugOfWar onAddXP={addXP}/>,
    championship:<Championship/>,
    xp:<XPPage user={user} onAddXP={addXP}/>,
    moodle:<Moodle/>
  };

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
      {/* Toasts */}
      <div style={{position:"fixed",top:80,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:"0.5rem"}}>
        {toasts.map(t=><XPToast key={t.id} gain={t.gain} label={t.label} onDone={()=>removeToast(t.id)}/>)}
      </div>

      {/* Level up modal */}
      {levelUp&&<LevelUpModal level={levelUp} onClose={()=>setLevelUp(null)}/>}

      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 1.5rem",height:60,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
          <div style={{width:36,height:36,background:C.orange,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem"}}>🏗️</div>
          <div style={{fontWeight:800,fontSize:"1rem",letterSpacing:"0.5px"}}>ProLycée</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
          {user.role==="eleve"&&(
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem",background:C.xpBg,border:`1px solid ${C.yellow}30`,borderRadius:20,padding:"0.3rem 0.8rem"}}>
              <span style={{fontSize:"0.85rem"}}>⭐</span>
              <span style={{fontFamily:"monospace",fontWeight:700,color:C.yellow,fontSize:"0.9rem"}}>{user.xp||0}</span>
              <span style={{fontSize:"0.65rem",color:C.muted}}>XP</span>
              <span style={{color:getLevelInfo(user.xp||0).current.color,fontSize:"0.85rem"}}>{getLevelInfo(user.xp||0).current.icon}</span>
            </div>
          )}
          <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:20,padding:"0.3rem 0.8rem",fontSize:"0.8rem",fontWeight:600}}>
            {user.role==="prof"?"👨‍🏫":"👨‍🎓"} {user.name}
          </div>
          <button onClick={()=>setUser(null)} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,padding:"0.3rem 0.7rem",borderRadius:8,fontSize:"0.75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Déconnexion</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <Sidebar active={active} setActive={setActive} user={user}/>
        <div style={{flex:1,overflowY:"auto",padding:"1.5rem"}}>
          <div style={{maxWidth:900,margin:"0 auto"}}>
            {panels[active]||panels.dashboard}
          </div>
        </div>
      </div>
    </div>
  );
}