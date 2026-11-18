import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { LiveHost, LiveJoin, Roster, LiveChampionship } from "./Live";

// ── XP SYSTEM ────────────────────────────────────────────────
const LEVELS = [
  { level: 1, name: "Apprenti Archi",   icon: "📐", xpMin: 0,    color: "#5b6472" },
  { level: 2, name: "Dessinateur",      icon: "✏️", xpMin: 500,  color: "#0e7490" },
  { level: 3, name: "Maquettiste BIM",  icon: "🏗️", xpMin: 1500, color: "#15803d" },
  { level: 4, name: "Chef de projet",   icon: "📋", xpMin: 3000, color: "#6d28d9" },
  { level: 5, name: "Maître TBAA",      icon: "👑", xpMin: 6000, color: "#a16207" },
];

const XP_GAINS = {
  kahoot_correct: 100, kahoot_win: 300,
  tug_correct: 150, tug_win: 200,
  resource_view: 20, combo_3: 50, combo_5: 150,
};

function getLevelInfo(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.xpMin) current = l; }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  const progress = next ? Math.round(((xp - current.xpMin) / (next.xpMin - current.xpMin)) * 100) : 100;
  return { current, next, progress };
}

function STUDENTS_DATA() {
  return [
    { name:"Amara D.",    classe:"terminale", s1:16, s2:15, s3:14, kahoot:1050, avg:15.2, xp:2800 },
    { name:"Youssef M.",  classe:"terminale", s1:14, s2:13, s3:15, kahoot:920,  avg:14,   xp:1900 },
    { name:"Kevin T.",    classe:"premiere",  s1:12, s2:14, s3:11, kahoot:780,  avg:12.5, xp:1200 },
    { name:"Saliou B.",   classe:"seconde",   s1:17, s2:16, s3:18, kahoot:1200, avg:17,   xp:4200 },
    { name:"Lucas P.",    classe:"terminale", s1:10, s2:11, s3:9,  kahoot:600,  avg:10,   xp:680  },
    { name:"Fatou N.",    classe:"premiere",  s1:15, s2:14, s3:16, kahoot:950,  avg:15,   xp:2100 },
    { name:"Thomas R.",   classe:"seconde",   s1:13, s2:12, s3:14, kahoot:820,  avg:13,   xp:1450 },
  ];
}
const STUDENTS = STUDENTS_DATA();

const SEQUENCES = {
  seconde:[
    {num:"01",title:"Progression à venir",periode:"Année scolaire",semaines:"À définir",
     resources:[{icon:"📋",name:"Contenu à importer depuis le fichier Excel de progression",s:"soon"}]},
  ],
  premiere:[
    {num:"01",title:"Progression à venir",periode:"Année scolaire",semaines:"À définir",
     resources:[{icon:"📋",name:"Contenu à importer depuis le fichier Excel de progression",s:"soon"}]},
  ],
  terminale:[
    {num:"01",title:"Progression à venir",periode:"Année scolaire",semaines:"À définir",
     resources:[{icon:"📋",name:"Contenu à importer depuis le fichier Excel de progression",s:"soon"}]},
  ],
};

const TOW_QS = {
  seconde:[
    {q:"Que signifie PLU ?",a:"plan local d'urbanisme"},
    {q:"Que signifie BIM ?",a:"building information modeling"},
    {q:"Quel logiciel sert à faire une maquette numérique 3D du bâtiment ?",a:"revit"},
  ],
  premiere:[
    {q:"Que signifie CCTP ?",a:"cahier des clauses techniques particulières"},
    {q:"Que signifie ERP ?",a:"établissement recevant du public"},
    {q:"Que signifie PMR ?",a:"personne à mobilité réduite"},
  ],
  terminale:[
    {q:"Que signifie Bbio ?",a:"besoin bioclimatique"},
    {q:"Que signifie CEP ?",a:"consommation en énergie primaire"},
    {q:"Que signifie RE2020 ?",a:"réglementation environnementale 2020"},
  ]
};

const SAMPLE_QUIZ = {
  id:1, title:"Bienvenue TBAA — Quiz de démarrage", filiere:"terminale",
  questions:[
    {q:"Que signifie BIM ?",answers:["Building Information Modeling","Base Immobilière Municipale","Bureau Interne des Marchés","Bâtiment Intelligent Modulaire"],correct:0,time:20},
    {q:"Que signifie PLU ?",answers:["Plan Local d'Urbanisme","Permis Légal Unique","Plan de Livraison Urbain","Programme Local d'Urbanisme"],correct:0,time:20},
    {q:"Quel logiciel BIM est utilisé pour la maquette numérique ?",answers:["Revit","Excel","Photoshop","Chrome"],correct:0,time:15},
    {q:"Que signifie PMR ?",answers:["Personne à Mobilité Réduite","Plan de Mise en Route","Protection Murale Renforcée","Passage Multi-Résidentiel"],correct:0,time:20},
  ]
};

// ── THÈME ────────────────────────────────────────────────────
// Mise en page, boutons, champs et responsive sont dans index.css.
// Ne restent ici que les couleurs calculées (niveau, classe, équipe…).
// « Encre » : même teinte qu'une couleur de la palette, assez foncée pour du
// petit texte sur fond teinté ou ivoire (contraste WCAG AA ≥ 4,5:1).
const INKS={"#a16207":"#854d0e","#15803d":"#166534","#0e7490":"#155e75","#c81e3a":"#a3152f","#5b6472":"#465060"};
const ink=c=>INKS[c]||c;
const tint=c=>`${c}1f`; // ≈ 12 % d'opacité
const edge=c=>`${c}59`; // ≈ 35 % d'opacité
const tone=c=>({background:tint(c),color:ink(c),borderColor:edge(c)});
const FILIERES={seconde:"Seconde",premiere:"Première",terminale:"Terminale"};
const LETTRES=["A","B","C","D"];

function Logo({size=36}){
  return <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect width="64" height="64" rx="12" fill="#8c2f39"/>
    <path d="M32 11 53 25v3H11v-3z" fill="#fff"/>
    <path d="M17 31h6v15h-6zM29 31h6v15h-6zM41 31h6v15h-6z" fill="#fff"/>
    <path d="M12 49h40v5H12z" fill="#e7c873"/>
  </svg>;
}
function Badge({type,children}){
  const map={seconde:"#0e7490",premiere:"#6d28d9",terminale:"#a16207",green:"#15803d",orange:"#8c2f39",yellow:"#a16207",purple:"#6d28d9"};
  return <span className="badge" style={tone(map[type]||map.green)}>{children}</span>;
}
function Btn({onClick,color,textColor,sm,variant="primary",className="",children,style={},...rest}){
  const vars={...(color?{"--btn-bg":color}:{}),...(textColor?{"--btn-fg":textColor}:{})};
  return <button type="button" onClick={onClick} className={`btn btn-${variant}${sm?" btn-sm":""}${className?" "+className:""}`} style={{...vars,...style}} {...rest}>{children}</button>;
}
function Chip({active,color,onClick,children}){
  return <button type="button" className="chip" aria-pressed={active} onClick={onClick} style={color?{"--chip":color}:undefined}>{children}</button>;
}
function Card({children,style={},className=""}){return <div className={`card${className?" "+className:""}`} style={style}>{children}</div>;}
function SectionTitle({children,action}){
  return <div className="section-head">
    <h2 className="section-title">{children}</h2>
    {action&&<div className="section-action">{action}</div>}
  </div>;
}
// `stack` : sur petit écran, le titre passe sous la ligne « retour … compteur » (titres longs, ex. quiz en cours).
function PageHeader({icon,title,subtitle,back,small,stack,children}){
  return <header className="page-head" data-size={small?"sm":undefined} data-stack={stack?"true":undefined}>
    {back}
    {icon&&<span className="page-icon" aria-hidden="true">{icon}</span>}
    <div className="page-head-text">
      <h1 className="page-title">{title}</h1>
      {subtitle&&<p className="page-sub">{subtitle}</p>}
    </div>
    {children&&<div className="page-head-extra">{children}</div>}
  </header>;
}
function Label({htmlFor,children}){return <label className="label" htmlFor={htmlFor}>{children}</label>;}
function Callout({color="#a16207",children,style={}}){
  return <div className="callout" style={{...tone(color),"--accent":color,...style}}>{children}</div>;
}
function Avatar({name,sm}){return <div className="avatar" data-size={sm?"sm":undefined} aria-hidden="true">{name[0]}</div>;}
function Progress({value,color,label}){
  return <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <div style={{width:`${value}%`,background:color}}/>
  </div>;
}
function NotePill({val}){
  const color=val>=14?"#15803d":val>=10?"#a16207":"#c81e3a";
  return <span className="badge note-pill num" style={tone(color)}>{val}</span>;
}
function XPBadge({xp,size="sm"}){
  const {current}=getLevelInfo(xp);
  return <span className="xp-badge" data-size={size} style={tone(current.color)}>
    <span aria-hidden="true">{current.icon}</span><span>{current.name}</span>
  </span>;
}
function XPBar({xp,showLabel=true}){
  const {current,next,progress}=getLevelInfo(xp);
  return <div>
    {showLabel&&<div className="xpbar-labels">
      <span className="num" style={{color:"#854d0e",fontWeight:700}}>⭐ {xp} XP</span>
      {next?<span className="muted">{next.xpMin-xp} XP → {next.icon} {next.name}</span>:<span style={{color:"#854d0e",fontWeight:600}}>👑 Niveau max !</span>}
    </div>}
    <div className="xpbar-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progression vers le niveau suivant">
      <div style={{width:`${progress}%`,background:current.color}}/>
    </div>
  </div>;
}
function XPToast({gain,label,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2500);return()=>clearTimeout(t);},[]);
  return <div className="toast">
    <div style={{fontSize:"1.5rem",lineHeight:1}} aria-hidden="true">⭐</div>
    <div><div className="toast-gain num">+{gain} XP</div><div className="toast-label">{label}</div></div>
  </div>;
}
function LevelUpModal({level,onClose}){
  // Fermeture au clavier (Échap) ; le bouton reçoit le focus à l'ouverture.
  useEffect(()=>{
    const onKey=e=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[onClose]);
  return <div className="modal-overlay">
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="levelup-title" style={{"--accent":level.color}}>
      <div className="modal-icon" aria-hidden="true">{level.icon}</div>
      <div className="overline" style={{letterSpacing:"0.14em"}}>Niveau {level.level} atteint !</div>
      <h2 id="levelup-title" className="modal-title" style={{color:ink(level.color)}}>{level.name}</h2>
      <Btn onClick={onClose} color={level.color} autoFocus>🎉 Super !</Btn>
    </div>
  </div>;
}

// ── LOGIN avec Supabase Auth ──────────────────────────────────
function Login({onLogin}){
  const [tab,setTab]=useState("prof");
  const [authMode,setAuthMode]=useState("connexion"); // connexion | inscription
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [nom,setNom]=useState("");
  const [niveau,setNiveau]=useState("seconde");
  const classe = niveau;
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const handleProfLogin=()=>{
    onLogin({role:"prof",name:"M. Khadim"});
  };

  const handleEleveConnexion=async()=>{
    if(!email||!password){setError("Remplis tous les champs");return;}
    setLoading(true);setError("");
    try{
      const {data,error:err}=await supabase.auth.signInWithPassword({email,password});
      if(err)throw err;
      const {data:profile}=await supabase.from("profiles").select("*").eq("id",data.user.id).single();
      if(profile){
        onLogin({role:"eleve",name:profile.nom,classe:profile.classe,xp:profile.xp||0,id:data.user.id});
      }else{
        setError("Profil introuvable. Crée un compte d'abord.");
      }
    }catch(e){
      setError(e.message==="Invalid login credentials"?"Email ou mot de passe incorrect":e.message);
    }
    setLoading(false);
  };

  const handleEleveInscription=async()=>{
    if(!email||!password||!nom){setError("Remplis tous les champs");return;}
    if(password.length<6){setError("Mot de passe : 6 caractères minimum");return;}
    setLoading(true);setError("");
    try{
      const {data,error:err}=await supabase.auth.signUp({email,password});
      if(err)throw err;
      const {error:profileErr}=await supabase.from("profiles").insert({id:data.user.id,nom:nom.trim(),classe,xp:0});
      if(profileErr)throw profileErr;
      onLogin({role:"eleve",name:nom.trim(),classe,xp:0,id:data.user.id});
    }catch(e){
      if(e.message.includes("already registered"))setError("Cet email est déjà utilisé. Connecte-toi !");
      else setError(e.message);
    }
    setLoading(false);
  };

  return <div className="login">
    <main className="login-card">
      <div className="login-brand">
        <Logo size={60}/>
        <h1 className="login-title">Pro<span>Lycée</span></h1>
        <div className="overline" style={{letterSpacing:"0.16em",marginTop:"0.1rem"}}>Plateforme pédagogique</div>
      </div>

      {/* Tabs Prof / Élève */}
      <div className="seg" role="group" aria-label="Type de compte">
        {["prof","eleve"].map(t=>(
          <button type="button" key={t} aria-pressed={tab===t} onClick={()=>{setTab(t);setError("");}}>
            {t==="prof"?"👨‍🏫 Professeur":"👨‍🎓 Élève"}
          </button>
        ))}
      </div>

      {tab==="prof"?(
        <form onSubmit={e=>{e.preventDefault();handleProfLogin();}}>
          <div className="form-row">
            <Label htmlFor="prof-identifiant">Identifiant</Label>
            <input id="prof-identifiant" className="field" defaultValue="prof.khadim" readOnly/>
          </div>
          <div className="form-row">
            <Label htmlFor="prof-mdp">Mot de passe</Label>
            <input id="prof-mdp" type="password" className="field" defaultValue="1234" readOnly/>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block">Se connecter →</button>
        </form>
      ):(
        <form noValidate onSubmit={e=>{e.preventDefault();(authMode==="connexion"?handleEleveConnexion:handleEleveInscription)();}}>
          {/* Connexion / Inscription tabs */}
          <div className="toggle-row" role="group" aria-label="Connexion ou inscription">
            {["connexion","inscription"].map(m=>(
              <button type="button" key={m} aria-pressed={authMode===m} onClick={()=>{setAuthMode(m);setError("");}}>
                {m==="connexion"?"🔑 Se connecter":"✨ Créer un compte"}
              </button>
            ))}
          </div>

          {authMode==="inscription"&&(
            <div className="form-row">
              <Label htmlFor="eleve-prenom">Ton prénom</Label>
              <input id="eleve-prenom" className="field" placeholder="Ex: Amara" autoComplete="given-name" value={nom} onChange={e=>setNom(e.target.value)}/>
            </div>
          )}

          <div className="form-row">
            <Label htmlFor="eleve-email">Email</Label>
            <input id="eleve-email" type="email" className="field" placeholder="ton.email@exemple.com" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/>
          </div>

          <div className="form-row">
            <Label htmlFor="eleve-mdp">Mot de passe</Label>
            <input id="eleve-mdp" type="password" className="field" placeholder="6 caractères minimum" autoComplete={authMode==="connexion"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)}/>
          </div>

          {authMode==="inscription"&&(<>
            <div className="form-row">
              <Label htmlFor="eleve-classe">Ta classe</Label>
              <select id="eleve-classe" className="field" value={niveau} onChange={e=>setNiveau(e.target.value)}>
                <option value="seconde">🏛️ Seconde</option>
                <option value="premiere">🏛️ 1ère TBAA</option>
                <option value="terminale">🏛️ Terminale TBAA</option>
              </select>
            </div>
          </>)}

          {error&&<div className="alert" role="alert">{error}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
            {loading?"⏳ Chargement...":(authMode==="connexion"?"Se connecter →":"Créer mon compte →")}
          </button>

          <div className="login-foot">
            {authMode==="connexion"?"Pas encore de compte ?":"Tu as déjà un compte ?"}
            <button type="button" className="link-btn" onClick={()=>{setAuthMode(authMode==="connexion"?"inscription":"connexion");setError("");}}>
              {authMode==="connexion"?"Créer un compte":"Se connecter"}
            </button>
          </div>
        </form>
      )}
    </main>
  </div>;
}

// ── SIDEBAR ───────────────────────────────────────────────────
// ≥ 900 px : colonne fixe. En dessous : panneau repliable ouvert par le bouton « Menu » de l'en-tête.
function Sidebar({active,setActive,user,open,onClose,onLogout}){
  const items=[
    {id:"dashboard",icon:"🏠",label:"Tableau de bord"},
    {id:"classes",icon:"📚",label:"Mes Classes"},
    {id:"notes",icon:"📊",label:"Notes & Suivi"},
    ...(user.role==="prof"?[{id:"roster",icon:"🧑‍🎓",label:"Élèves & codes"}]:[]),
    null,
    {id:"kahoot",icon:"🎮",label:"Kahoot"},
    {id:"tugofwar",icon:"🎯",label:"Tug of War"},
    {id:"championship",icon:"🏆",label:"Championnat"},
    null,
    {id:"xp",icon:"⭐",label:"Mon XP"},
    ...(user.role==="prof"?[null,{id:"moodle",icon:"🎓",label:"Éléa / Moodle"}]:[]),
  ];
  const groups=["Jeux","Progression","Ressources"];
  return <>
    <nav id="menu-principal" className="app-sidebar" data-open={open?"true":"false"} aria-label="Navigation principale">
      <div className="overline nav-group">Pédagogie</div>
      {items.map((item,i)=>item===null?(
        <div key={i} role="presentation">
          <div className="nav-sep"/>
          <div className="overline nav-group">{groups[items.slice(0,i).filter(x=>x===null).length]}</div>
        </div>
      ):(
        <button type="button" key={item.id} className="nav-item" aria-current={active===item.id?"page":undefined} onClick={()=>{setActive(item.id);onClose();}}>
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          {item.label}
          {item.id==="xp"&&<span className="nav-tag">XP</span>}
        </button>
      ))}
      <div className="sidebar-account">
        <div className="sidebar-user">{user.role==="prof"?"👨‍🏫":"👨‍🎓"} {user.name}</div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>Déconnexion</button>
      </div>
    </nav>
    {open&&<div className="menu-backdrop" onClick={onClose} aria-hidden="true"/>}
  </>;
}

// ── XP PAGE ───────────────────────────────────────────────────
function XPPage({user,onAddXP}){
  const xp=user.xp||0;
  const {current,next,progress}=getLevelInfo(xp);
  const sorted=[...STUDENTS].sort((a,b)=>b.xp-a.xp);
  return <div>
    <PageHeader icon="⭐" title="Mon XP" subtitle="Niveaux, gains et classement"/>
    <section className="hero">
      <div className="hero-top">
        <div className="level-tile" style={{borderColor:edge(current.color)}} aria-hidden="true">{current.icon}</div>
        <div className="hero-id">
          <div className="overline">Niveau {current.level}</div>
          <div className="hero-name" style={{color:ink(current.color)}}>{current.name}</div>
        </div>
        <div className="hero-xp">
          <div className="hero-xp-val num">{xp}</div>
          <div className="overline">XP total</div>
        </div>
      </div>
      <XPBar xp={xp}/>
    </section>

    <Card style={{marginBottom:"1.5rem"}}>
      <SectionTitle>🗺️ Parcours de progression</SectionTitle>
      <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
        {LEVELS.map((lvl,i)=>{
          const unlocked=xp>=lvl.xpMin;
          const isCurrent=current.level===lvl.level;
          return <div key={i} className="level-row" data-state={isCurrent?"current":unlocked?"done":"locked"} style={isCurrent?{background:tint(lvl.color),borderColor:edge(lvl.color)}:undefined}>
            <div className="level-tile" data-size="sm" style={unlocked?{borderColor:edge(lvl.color)}:undefined} aria-hidden="true">{lvl.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
                <span className="level-name" style={{color:unlocked?ink(lvl.color):"#5b6472"}}>{lvl.name}</span>
                {isCurrent&&<span className="badge" style={{background:"#fff",color:ink(lvl.color),borderColor:edge(lvl.color)}}>Actuel</span>}
              </div>
              <div className="level-meta">Niveau {lvl.level} · {lvl.xpMin} XP requis</div>
            </div>
            {unlocked?<div className="level-check" role="img" aria-label="Niveau atteint">✓</div>:<div className="level-missing">🔒 {lvl.xpMin-xp} XP manquants</div>}
          </div>;
        })}
      </div>
    </Card>

    <Card style={{marginBottom:"1.5rem"}}>
      <SectionTitle>💡 Comment gagner des XP</SectionTitle>
      <div className="grid-auto" style={{"--min":"250px",gap:"0.6rem"}}>
        {[["🎮","Kahoot — bonne réponse","+100 XP","#0e7490"],["🏆","Kahoot — victoire finale","+300 XP","#a16207"],["🎯","Tug of War — bonne réponse","+150 XP","#8c2f39"],["💪","Tug of War — victoire","+200 XP","#c81e3a"],["📖","Consulter une ressource","+20 XP","#15803d"],["🔥","Combo 3 bonnes réponses","+50 XP","#6d28d9"],["⚡","Combo 5 bonnes réponses","+150 XP","#6d28d9"]].map(([icon,label,gain,col])=>(
          <div key={label} className="gain">
            <span style={{fontSize:"1.2rem"}} aria-hidden="true">{icon}</span>
            <div className="gain-label">{label}</div>
            <span className="badge num" style={{background:"#fff",color:ink(col),borderColor:edge(col)}}>{gain}</span>
          </div>
        ))}
      </div>
    </Card>

    <Card>
      <SectionTitle>🏆 Classement XP</SectionTitle>
      {sorted.map((st,i)=>{
        const {current:lvl}=getLevelInfo(st.xp);
        return <div key={st.name} className="rank-row">
          <div className="rank-pos">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
          <Avatar name={st.name}/>
          <div className="rank-who"><div className="rank-name">{st.name}</div><XPBadge xp={st.xp}/></div>
          <div className="rank-xp num">{st.xp}<small>XP</small></div>
        </div>;
      })}
    </Card>

    {user.role==="eleve"&&<div style={{marginTop:"1rem",textAlign:"center"}}><Btn onClick={()=>onAddXP(100,"Test XP")} variant="secondary" sm>🧪 Test +100 XP</Btn></div>}
  </div>;
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({user,onAddXP}){
  if(user.role==="eleve"){
    const seqs=SEQUENCES[user.classe?.split("_")[0]]||SEQUENCES.seconde;
    const [open,setOpen]=useState(null);
    const xp=user.xp||0;
    const {current}=getLevelInfo(xp);
    const CLASSE_LABELS={
      seconde:"🏛️ Seconde",
      premiere:"🏛️ 1ère TBAA",
      terminale:"🏛️ Terminale TBAA",
    };
    const labels={seconde:"🏛️ Seconde",premiere:"🏛️ 1ère TBAA",terminale:"🏛️ Terminale TBAA"};
    return <div>
      <section className="hero">
        <div className="hero-top">
          <div className="level-tile" style={{borderColor:edge(current.color)}} aria-hidden="true">{current.icon}</div>
          <div className="hero-id">
            <h1 className="hero-name">{user.name}</h1>
            <div className="hero-sub">{CLASSE_LABELS[user.classe]||labels[user.classe?.split("_")[0]]||user.classe}</div>
            <div className="hero-badges"><XPBadge xp={xp} size="lg"/><Badge type="orange">⚡ 5 TP réalisés</Badge></div>
          </div>
          <div className="hero-xp">
            <div className="hero-xp-val num">{xp}</div>
            <div className="overline">XP total</div>
          </div>
        </div>
        <XPBar xp={xp}/>
      </section>
      <div className="stats" data-cols="4">
        {[["14.5","#15803d","Moyenne générale"],["16","#0e7490","Meilleure note"],["87%","#a16207","Progression"],[`Niv.${current.level}`,current.color,"Niveau actuel"]].map(([v,col,label])=>(
          <Card key={label} className="stat"><div className="stat-val" style={{color:col}}>{v}</div><div className="overline stat-label">{label}</div></Card>
        ))}
      </div>
      <Card>
        <SectionTitle>📚 Ma progression</SectionTitle>
        {seqs.map((seq,i)=>(
          <div key={i} className="acc">
            <button type="button" className="acc-head" aria-expanded={open===i} onClick={()=>setOpen(open===i?null:i)}>
              <span className="acc-num num" style={{color:"#8c2f39"}}>{seq.num}</span>
              <span className="acc-text"><span className="acc-title">{seq.title}</span><span className="acc-meta">📅 {seq.periode} · {seq.semaines}</span></span>
              <span className="acc-chevron" aria-hidden="true">▶</span>
            </button>
            {open===i&&<div className="acc-body">
              {seq.resources.map((r,j)=>{
                const view=()=>{if(r.s==="ok")onAddXP(XP_GAINS.resource_view,"Ressource consultée");};
                const content=<>
                  <span className="res-icon" aria-hidden="true">{r.icon}</span>
                  <span className="res-name">{r.name}</span>
                  {r.s==="ok"&&<span className="res-xp">+{XP_GAINS.resource_view} XP</span>}
                  <span className="badge" style={tone(r.s==="ok"?"#15803d":r.s==="wip"?"#8c2f39":"#5b6472")}>{r.s==="ok"?"Disponible":r.s==="wip"?"En cours":"Bientôt"}</span>
                </>;
                // Ressource disponible : vrai bouton (utilisable au clavier) ; sinon simple ligne.
                return r.s==="ok"
                  ?<button type="button" key={j} className="res" onClick={view}>{content}</button>
                  :<div key={j} className="res" onClick={view}>{content}</div>;
              })}
            </div>}
          </div>
        ))}
      </Card>
    </div>;
  }

  const sorted=[...STUDENTS].sort((a,b)=>b.xp-a.xp).slice(0,3);
  return <div>
    <PageHeader icon="🏠" title="Tableau de bord" subtitle={`Bienvenue, ${user.name}`}/>
    <div className="stats">
      {[["3","#0e7490","Classes actives"],["47","#15803d","Élèves connectés"],["12","#8c2f39","Quiz créés"]].map(([v,col,label])=>(
        <Card key={label} className="stat"><div className="stat-val" style={{color:col}}>{v}</div><div className="overline stat-label">{label}</div></Card>
      ))}
    </div>
    <div className="grid-auto" style={{"--min":"280px"}}>
      <Card>
        <SectionTitle>📈 Progression par classe</SectionTitle>
        {[["🏛️ Seconde","68","#0e7490"],["🏛️ 1ère TBAA","61","#6d28d9"],["🏛️ Terminale TBAA","75","#a16207"]].map(([label,val,col])=>(
          <div key={label} style={{marginBottom:"0.9rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:"0.75rem",fontSize:"0.84rem",marginBottom:"0.2rem"}}><span>{label}</span><span className="num" style={{color:ink(col),fontWeight:700}}>{val}%</span></div>
            <Progress value={parseInt(val)} color={col} label={`Progression ${label}`}/>
          </div>
        ))}
      </Card>
      <Card>
        <SectionTitle>⭐ Top XP élèves</SectionTitle>
        {sorted.map((st,i)=>{
          const {current:lvl}=getLevelInfo(st.xp);
          return <div key={st.name} className="rank-row">
            <div className="rank-pos">{i===0?"🥇":i===1?"🥈":"🥉"}</div>
            <Avatar name={st.name} sm/>
            <div className="rank-who"><div className="rank-name">{st.name}</div><XPBadge xp={st.xp}/></div>
            <div className="rank-xp num">{st.xp}</div>
          </div>;
        })}
      </Card>
    </div>
  </div>;
}

// ── CLASSES ───────────────────────────────────────────────────
function Classes(){
  const [selected,setSelected]=useState(null);
  const [open,setOpen]=useState(null);
  // Liste ↔ détail : on repart du haut de la page
  useEffect(()=>{window.scrollTo(0,0);},[selected]);
  const meta={
    seconde:{label:"Tronc commun",title:"Seconde",sub:"Seconde famille des métiers du bâtiment",icon:"🏛️",color:"#0e7490"},
    premiere:{label:"Bac Pro",title:"1ère TBAA",sub:"Technicien du Bâtiment — Option Assistant en Architecture",icon:"📐",color:"#6d28d9"},
    terminale:{label:"Bac Pro",title:"Terminale TBAA",sub:"Technicien du Bâtiment — Option Assistant en Architecture",icon:"🏗️",color:"#a16207"},
  };
  if(selected){
    const m=meta[selected];const seqs=SEQUENCES[selected];
    return <div>
      <PageHeader small icon={m.icon} title={m.title} subtitle="Progression annuelle" back={<Btn onClick={()=>{setSelected(null);setOpen(null)}} variant="secondary" sm>← Retour</Btn>}/>
      {seqs.map((seq,i)=>(
        <div key={i} className="acc">
          <button type="button" className="acc-head" aria-expanded={open===i} onClick={()=>setOpen(open===i?null:i)}>
            <span className="acc-num num" style={{color:ink(m.color)}}>{seq.num}</span>
            <span className="acc-text"><span className="acc-title">{seq.title}</span><span className="acc-meta">📅 {seq.periode} · {seq.semaines}</span></span>
            <span className="acc-chevron" aria-hidden="true">▶</span>
          </button>
          {open===i&&<div className="acc-body">
            {seq.resources.map((r,j)=>(
              <div key={j} className="res">
                <span className="res-icon" aria-hidden="true">{r.icon}</span>
                <span className="res-name">{r.name}</span>
                <span className="badge" style={tone(r.s==="ok"?"#15803d":r.s==="wip"?"#8c2f39":"#5b6472")}>{r.s==="ok"?"Disponible":r.s==="wip"?"En cours":"Bientôt"}</span>
              </div>
            ))}
          </div>}
        </div>
      ))}
    </div>;
  }
  return <div>
    <PageHeader icon="📚" title="Mes Classes" subtitle="Progressions pédagogiques annuelles"/>
    <div className="grid-auto" style={{"--min":"220px",gap:"1.2rem"}}>
      {Object.entries(meta).map(([k,m])=>(
        <div key={k} onClick={()=>setSelected(k)} className="class-card card-accent" style={{"--accent":m.color}}>
          <div className="class-card-head">
            <Badge type={k}>{m.label}</Badge>
            <div className="class-card-icon" aria-hidden="true">{m.icon}</div>
            <h2 className="class-card-title">{m.title}</h2>
            <div className="page-sub">{m.sub}</div>
          </div>
          <div className="class-card-foot">
            <div className="hint" style={{marginBottom:"0.8rem"}}>{SEQUENCES[k].length} séquence{SEQUENCES[k].length>1?"s":""}</div>
            <Btn style={{width:"100%"}}>Voir la progression →</Btn>
          </div>
        </div>
      ))}
    </div>
  </div>;
}

// ── NOTES ─────────────────────────────────────────────────────
function Notes(){
  const [filter,setFilter]=useState("all");
  const [dbProfiles,setDbProfiles]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const loadProfiles=async()=>{
      const {data}=await supabase.from("profiles").select("*").order("xp",{ascending:false});
      if(data&&data.length>0) setDbProfiles(data);
      setLoading(false);
    };
    loadProfiles();
  },[]);

  const students=dbProfiles.length>0?dbProfiles:STUDENTS;
  const filtered=filter==="all"?students:students.filter(st=>(st.classe||"").startsWith(filter));
  const headers=["Élève","Classe","XP","Niveau",dbProfiles.length===0?"Seq 1":"",dbProfiles.length===0?"Moyenne":""].filter(Boolean);

  return <div>
    <PageHeader icon="📊" title="Notes & Suivi" subtitle={dbProfiles.length>0?`${dbProfiles.length} élèves inscrits en temps réel`:"Données de démonstration"}/>
    <div className="chip-row" role="group" aria-label="Filtrer par classe" style={{marginBottom:"1.2rem"}}>
      {[["all","Tous","#8c2f39"],["seconde","🏛️ Seconde","#0e7490"],["premiere","📐 1ère TBAA","#6d28d9"],["terminale","🏗️ Terminale TBAA","#a16207"]].map(([f,label,col])=>(
        <Chip key={f} active={filter===f} color={col} onClick={()=>setFilter(f)}>{label}</Chip>
      ))}
    </div>
    {loading?<Card><div role="status" style={{textAlign:"center",color:"#5b6472",padding:"2rem"}}>⏳ Chargement des élèves...</div></Card>:(
      <Card>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau des notes et du suivi">
          <table className="table">
            <thead>
              <tr>{headers.map(h=>(
                <th key={h} scope="col" className={h==="XP"?"r":undefined}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((st,i)=>{
                const xp=st.xp||0;
                const {current}=getLevelInfo(xp);
                return <tr key={st.name||st.nom||i}>
                  <td className="cell-name" title={st.nom||st.name}>{st.nom||st.name}</td>
                  <td>{
                    {seconde:"🏛️ Seconde",premiere:"📐 1ère TBAA",terminale:"🏗️ Terminale TBAA"}[st.classe]||st.classe
                  }</td>
                  <td className="r num" style={{color:"#854d0e",fontWeight:700}}>{xp}</td>
                  <td><span style={{color:ink(current.color),fontWeight:700}}>{current.icon} {current.name}</span></td>
                  {st.s1!==undefined&&<td><NotePill val={st.s1}/></td>}
                  {st.avg!==undefined&&<td><NotePill val={st.avg}/></td>}
                </tr>;
              })}
              {filtered.length===0&&<tr><td colSpan={headers.length} style={{textAlign:"center",color:"#5b6472",padding:"1.5rem 0.8rem",whiteSpace:"normal"}}>Aucun élève dans cette classe pour le moment.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    )}
  </div>;
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
  const [quizFiliere,setQuizFiliere]=useState("terminale");
  const [iaTopique,setIaTopique]=useState("");
  const [iaFiliere,setIaFiliere]=useState("terminale");
  const [iaNb,setIaNb]=useState(5);
  const [courseText,setCourseText]=useState("");
  const [generated,setGenerated]=useState([]);
  const [loading,setLoading]=useState(false);
  const [combo,setCombo]=useState(0);
  const [liveQuiz,setLiveQuiz]=useState(null);
  const timerRef=useRef(null);
  const colors=["#e74c3c","#3498db","#2ecc71","#f39c12"];

  // Changement d'écran ou de question : on repart du haut de la page
  useEffect(()=>{window.scrollTo(0,0);},[mode,qIdx]);

  const startQuiz=(quiz)=>{
    const initScores={};STUDENTS.forEach(st=>{initScores[st.name]=0;});
    setPlaying(quiz);setQIdx(0);setChosen(null);setScores(initScores);setTimer(quiz.questions[0]?.time||30);setMode("play");setCombo(0);
  };

  useEffect(()=>{
    if(mode!=="play"||chosen!==null) return;
    timerRef.current=setInterval(()=>{setTimer(t=>{if(t<=1){clearInterval(timerRef.current);setChosen(-1);return 0;}return t-1;});},1000);
    return()=>clearInterval(timerRef.current);
  },[mode,qIdx,chosen]);

  const answer=(idx)=>{
    if(chosen!==null) return;
    clearInterval(timerRef.current);setChosen(idx);
    const q=playing.questions[qIdx];
    if(idx===q.correct){
      const newCombo=combo+1;setCombo(newCombo);
      onAddXP(XP_GAINS.kahoot_correct,"Kahoot — bonne réponse");
      if(newCombo===3)onAddXP(XP_GAINS.combo_3,"🔥 Combo x3 !");
      if(newCombo===5)onAddXP(XP_GAINS.combo_5,"⚡ Combo x5 !");
      setScores(prev=>{const next={...prev};STUDENTS.forEach(st=>{if(Math.random()>0.4)next[st.name]=(next[st.name]||0)+Math.floor(Math.random()*600+200);});return next;});
    }else{setCombo(0);}
  };

  const nextQ=()=>{
    const next=qIdx+1;
    if(next>=playing.questions.length){onAddXP(XP_GAINS.kahoot_win,"🏆 Quiz terminé !");setMode("result");return;}
    setQIdx(next);setChosen(null);setTimer(playing.questions[next]?.time||30);
  };

  const generateQuestions=async(text,fromCourse=false)=>{
    setLoading(true);
    try{
      const filiereName={seconde:"assistant en architecture, niveau seconde",premiere:"assistant en architecture, niveau première bac pro",terminale:"assistant en architecture, niveau terminale bac pro"}[iaFiliere];
      const prompt=fromCourse
        ?`À partir de ce cours de lycée professionnel, génère 8 questions QCM. Réponds UNIQUEMENT en JSON valide:\n{"questions":[{"q":"?","answers":["r1","r2","r3","r4"],"correct":0,"time":20}]}\n\nCours:\n${text.slice(0,2000)}`
        :`Tu es professeur en ${filiereName}. Génère ${iaNb} questions QCM sur: "${text}". Réponds UNIQUEMENT en JSON valide:\n{"questions":[{"q":"?","answers":["r1","r2","r3","r4"],"correct":0,"time":20}]}`;
      const resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await resp.json();
      const raw=data.content.map(c=>c.text||"").join("");
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setGenerated(parsed.questions||[]);
    }catch(e){
      const fallback=TOW_QS[iaFiliere]||TOW_QS.terminale;
      setGenerated(fallback.slice(0,fromCourse?6:iaNb).map(q=>({q:q.q,answers:[q.a,"Mauvaise réponse B","Mauvaise réponse C","Mauvaise réponse D"],correct:0,time:20})));
    }
    setLoading(false);
  };

  if(liveQuiz){
    return <LiveHost quiz={liveQuiz} onExit={()=>setLiveQuiz(null)}/>;
  }

  if(mode==="play"&&playing){
    const q=playing.questions[qIdx];
    const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const timerColor=timer<=5?"#c81e3a":timer<=10?"#a16207":"#8c2f39";
    return <div>
      <PageHeader small stack title={playing.title} back={<Btn onClick={()=>{clearInterval(timerRef.current);setMode("menu");}} variant="secondary" sm>✕ Stop</Btn>}>
        {combo>=2&&<span className="badge" style={tone("#8c2f39")}>🔥 Combo x{combo}</span>}
        <span className="page-meta num">Question {qIdx+1}/{playing.questions.length}</span>
      </PageHeader>
      <div className="card card-accent kh-question">
        <h2 className="kh-q">{q.q}</h2>
        <div className="kh-timer" role="timer" aria-label={`${timer} secondes restantes`} style={{color:timerColor}}>{timer}<small>s</small></div>
        <div className="kh-timebar" aria-hidden="true"><div key={qIdx} style={{width:`${Math.max(0,Math.min(100,(timer/(q.time||30))*100))}%`,background:timerColor}}/></div>
      </div>
      <div className="kh-grid">
        {(q.answers||[]).map((a,i)=>{
          // Après la réponse : bonne réponse en vert, mauvais choix en rouge, les autres en pastel (texte toujours lisible).
          const state=chosen===null?"idle":i===q.correct?"correct":i===chosen?"wrong":"muted";
          return <button type="button" key={i} onClick={()=>answer(i)} disabled={chosen!==null} className="kh-answer" data-state={state} style={{"--kh":colors[i],...(state==="muted"?{background:`${colors[i]}33`}:{})}}>
            <span className="kh-letter" aria-hidden="true">{state==="correct"?"✓":state==="wrong"?"✕":LETTRES[i]}</span>
            <span className="kh-text">{a}</span>
          </button>;
        })}
      </div>
      {chosen!==null&&<>
        <div className="banner" data-tone={chosen===q.correct?"ok":"ko"} role="status">
          {chosen===q.correct?`✅ Correct ! +${XP_GAINS.kahoot_correct} XP`:"❌ Incorrect — bonne réponse : "+q.answers[q.correct]}
        </div>
        <Card style={{marginBottom:"1rem"}}>
          <div className="overline" style={{marginBottom:"0.3rem"}}>🏆 Scores</div>
          {sorted.map(([name,pts],i)=>(
            <div key={name} className="score-row">
              <span className="score-pos num">{i+1}</span>
              <span className="score-name">{name}</span>
              <span className="score-pts num">{pts} pts</span>
            </div>
          ))}
        </Card>
        <div style={{textAlign:"center"}}><Btn onClick={nextQ}>{qIdx+1<playing.questions.length?"Question suivante →":"Terminer 🏆"}</Btn></div>
      </>}
    </div>;
  }

  if(mode==="result"){
    const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    return <div className="result">
      <div className="result-emoji" aria-hidden="true">🏆</div>
      <h1 className="page-title" style={{marginBottom:"1rem"}}>Quiz terminé !</h1>
      <Callout style={{textAlign:"center",fontSize:"0.95rem",marginBottom:"1.5rem"}}>⭐ +{XP_GAINS.kahoot_win} XP bonus !</Callout>
      <Card style={{textAlign:"left",marginBottom:"1.5rem"}}>
        <SectionTitle>Classement final</SectionTitle>
        {sorted.map(([name,pts],i)=>(
          <div key={name} className="score-row">
            <span className="score-pos num" style={{color:"#854d0e",fontSize:"1.05rem"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
            <span className="score-name">{name}</span>
            <span className="score-pts num">{pts} pts</span>
          </div>
        ))}
      </Card>
      <Btn onClick={()=>setMode("menu")}>← Retour aux quiz</Btn>
    </div>;
  }

  if(mode==="manual"){
    const addQ=()=>setManualQs(prev=>[...prev,{q:"",answers:["","","",""],correct:0,time:30}]);
    const updQ=(i,field,val)=>setManualQs(prev=>prev.map((q,qi)=>qi===i?{...q,[field]:val}:q));
    const updAns=(qi,ai,val)=>setManualQs(prev=>prev.map((q,i)=>i===qi?{...q,answers:q.answers.map((a,j)=>j===ai?val:a)}:q));
    // Sans aucune question saisie, le quiz serait vide : les boutons d'enregistrement restent désactivés.
    const canSave=manualQs.some(q=>q.q.trim());
    return <div>
      <PageHeader small icon="✏️" title="Créer un quiz" back={<Btn onClick={()=>setMode("menu")} variant="secondary" sm>← Retour</Btn>}/>
      <Card style={{marginBottom:"1rem"}}>
        <div className="grid-2 stack-sm" style={{gap:"0.8rem"}}>
          <div><Label htmlFor="quiz-titre">Titre</Label><input id="quiz-titre" className="field" placeholder="Titre du quiz..." value={quizTitle} onChange={e=>setQuizTitle(e.target.value)}/></div>
          <div><Label htmlFor="quiz-filiere">Filière</Label>
            <select id="quiz-filiere" className="field" value={quizFiliere} onChange={e=>setQuizFiliere(e.target.value)}>
              <option value="seconde">🏛️ Seconde</option><option value="premiere">📐 1ère TBAA</option><option value="terminale">🏗️ Terminale TBAA</option>
            </select>
          </div>
        </div>
      </Card>
      {manualQs.map((mq,qi)=>(
        <Card key={qi} style={{marginBottom:"0.8rem"}}>
          <div className="overline" style={{color:"#8c2f39",marginBottom:"0.6rem"}}>Question {qi+1}</div>
          <input className="field" style={{marginBottom:"0.6rem"}} aria-label={`Énoncé de la question ${qi+1}`} placeholder="Tapez votre question..." value={mq.q} onChange={e=>updQ(qi,"q",e.target.value)}/>
          <div className="chip-row" role="group" aria-label={`Temps de réponse de la question ${qi+1}`} style={{marginBottom:"0.7rem"}}>
            <span className="hint">Temps :</span>
            {[15,20,30,45,60].map(t=><Chip key={t} active={mq.time===t} onClick={()=>updQ(qi,"time",t)}>{t}s</Chip>)}
          </div>
          <div className="grid-2 stack-sm" style={{gap:"0.5rem"}}>
            {mq.answers.map((a,ai)=>(
              <div key={ai} className="answer-edit" data-correct={mq.correct===ai}>
                <span className="dot" style={{background:colors[ai]}} aria-hidden="true"/>
                <input aria-label={`Réponse ${LETTRES[ai]} de la question ${qi+1}`} placeholder={`Réponse ${LETTRES[ai]}`} value={a} onChange={e=>updAns(qi,ai,e.target.value)}/>
                <button type="button" className="answer-check" aria-pressed={mq.correct===ai} aria-label={`Réponse ${LETTRES[ai]} : bonne réponse`} title="Marquer comme bonne réponse" onClick={()=>updQ(qi,"correct",ai)}>✓</button>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <div className="btn-row">
        <Btn onClick={addQ} variant="secondary">+ Ajouter question</Btn>
        <Btn disabled={!canSave} onClick={()=>{const q={id:Date.now(),title:quizTitle||"Quiz sans titre",filiere:quizFiliere,questions:manualQs.filter(q=>q.q.trim())};setQuizzes(p=>[...p,q]);startQuiz(q);}}>💾 Sauver & Lancer</Btn>
        <Btn disabled={!canSave} onClick={()=>{const q={id:Date.now(),title:quizTitle||"Quiz sans titre",filiere:quizFiliere,questions:manualQs.filter(q=>q.q.trim())};setQuizzes(p=>[...p,q]);setMode("menu");}} variant="secondary">💾 Sauver seulement</Btn>
      </div>
      {!canSave&&<p className="hint" style={{marginTop:"0.6rem"}}>Saisissez au moins une question pour enregistrer le quiz.</p>}
    </div>;
  }

  if(mode==="ia"){
    return <div>
      <PageHeader small icon="🤖" title="Génération IA" back={<Btn onClick={()=>setMode("menu")} variant="secondary" sm>← Retour</Btn>}/>
      <div className="card card-accent" style={{"--accent":"#6d28d9",marginBottom:"1rem"}}>
        <h2 className="card-title">L'IA génère vos questions</h2>
        <div className="form-row">
          <div className="label" id="ia-filiere">Filière</div>
          <div className="chip-row" role="group" aria-labelledby="ia-filiere">
            {[["seconde","🏛️ Seconde"],["premiere","📐 1ère TBAA"],["terminale","🏗️ Terminale TBAA"]].map(([k,label])=>(
              <Chip key={k} active={iaFiliere===k} color="#6d28d9" onClick={()=>setIaFiliere(k)}>{label}</Chip>
            ))}
          </div>
        </div>
        <div className="form-row">
          <Label htmlFor="ia-sujet">Sujet</Label>
          <input id="ia-sujet" className="field" placeholder="Ex: Protection des personnes, disjoncteurs..." value={iaTopique} onChange={e=>setIaTopique(e.target.value)}/>
        </div>
        <div className="form-row" style={{marginBottom:"1.1rem"}}>
          <div className="label" id="ia-nombre">Nombre</div>
          <div className="chip-row" role="group" aria-labelledby="ia-nombre">
            {[5,10,15].map(n=><Chip key={n} active={iaNb===n} color="#6d28d9" onClick={()=>setIaNb(n)}>{n} questions</Chip>)}
          </div>
        </div>
        <Btn onClick={()=>generateQuestions(iaTopique)} color="#6d28d9" disabled={loading} aria-busy={loading}>
          {loading?"⏳ Génération...":"🤖 Générer les questions"}
        </Btn>
      </div>
      {generated.length>0&&<>
        {generated.map((q,i)=>(
          <Card key={i} style={{marginBottom:"0.6rem"}}>
            <div className="overline" style={{color:"#6d28d9",marginBottom:"0.4rem"}}>Q{i+1} · {q.time}s</div>
            <div style={{fontWeight:600,marginBottom:"0.6rem"}}>{q.q}</div>
            <div className="grid-2 stack-sm" style={{gap:"0.4rem"}}>
              {(q.answers||[]).map((a,ai)=>(
                <div key={ai} className="answer-view" data-correct={ai===q.correct}>
                  <span className="dot" style={{background:colors[ai]}} aria-hidden="true"/>
                  <span>{a}</span>
                  {ai===q.correct&&<span role="img" aria-label="Bonne réponse" style={{marginLeft:"auto",fontWeight:700}}>✓</span>}
                </div>
              ))}
            </div>
          </Card>
        ))}
        <div className="btn-row" style={{marginTop:"1rem"}}>
          <Btn onClick={()=>{const q={id:Date.now(),title:`Quiz IA — ${iaFiliere}`,filiere:iaFiliere,questions:generated};setQuizzes(p=>[...p,q]);startQuiz(q);}}>🚀 Lancer</Btn>
          <Btn onClick={()=>{setQuizzes(p=>[...p,{id:Date.now(),title:`Quiz IA — ${iaFiliere}`,filiere:iaFiliere,questions:generated}]);setMode("menu");}} variant="secondary">💾 Sauvegarder</Btn>
        </div>
      </>}
    </div>;
  }

  if(mode==="pdf"){
    return <div>
      <PageHeader small icon="📄" title="Quiz depuis votre cours" back={<Btn onClick={()=>setMode("menu")} variant="secondary" sm>← Retour</Btn>}/>
      <div className="card card-accent" style={{"--accent":"#15803d"}}>
        <h2 className="card-title"><label htmlFor="cours-texte">Collez votre cours ici</label></h2>
        <textarea id="cours-texte" className="field" placeholder="Collez le texte de votre cours ici..." value={courseText} onChange={e=>setCourseText(e.target.value)}/>
        <div style={{marginTop:"0.8rem"}}>
          <Btn onClick={()=>generateQuestions(courseText,true)} color="#15803d" disabled={loading} aria-busy={loading}>
            {loading?"⏳ Génération...":"🤖 Extraire les questions"}
          </Btn>
        </div>
      </div>
      {generated.length>0&&<>
        <div role="status" style={{margin:"1rem 0 0.5rem",fontWeight:700}}>✅ {generated.length} questions générées</div>
        {generated.map((q,i)=>(
          <Card key={i} style={{marginBottom:"0.6rem"}}>
            <div style={{fontWeight:600,marginBottom:"0.5rem"}}>{i+1}. {q.q}</div>
            <div className="grid-2 stack-sm" style={{gap:"0.4rem"}}>
              {(q.answers||[]).map((a,ai)=><div key={ai} className="answer-view" data-correct={ai===q.correct}><span>{LETTRES[ai]}. {a}</span></div>)}
            </div>
          </Card>
        ))}
        <div className="btn-row" style={{marginTop:"1rem"}}>
          <Btn onClick={()=>{const q={id:Date.now(),title:"Quiz depuis cours",filiere:"terminale",questions:generated};setQuizzes(p=>[...p,q]);startQuiz(q);}}>🚀 Lancer</Btn>
          <Btn onClick={()=>{setQuizzes(p=>[...p,{id:Date.now(),title:"Quiz depuis cours",filiere:"terminale",questions:generated}]);setMode("menu");}} variant="secondary">💾 Sauvegarder</Btn>
        </div>
      </>}
    </div>;
  }

  return <div>
    <PageHeader icon="🎮" title="Kahoot" subtitle="Créez et lancez des quiz interactifs"/>
    <Callout>⭐ +{XP_GAINS.kahoot_correct} XP par bonne réponse · +{XP_GAINS.kahoot_win} XP à la fin · Bonus combo !</Callout>
    <div className="grid-auto" style={{"--min":"200px",marginBottom:"2rem"}}>
      {[["✏️","Manuel","Tapez vos propres questions","manual","#8c2f39"],["🤖","IA","L'IA génère les questions","ia","#6d28d9"],["📄","Depuis cours","Collez votre cours","pdf","#15803d"]].map(([icon,title,sub,m,col])=>(
        <button type="button" key={m} onClick={()=>setMode(m)} className="mode-card" style={{"--accent":col}}>
          <span className="mode-icon" aria-hidden="true">{icon}</span>
          <span className="mode-title">{title}</span>
          <span className="mode-sub">{sub}</span>
        </button>
      ))}
    </div>
    <SectionTitle action={<Btn onClick={()=>setMode("manual")} sm>+ Nouveau</Btn>}>📋 Quiz sauvegardés</SectionTitle>
    {quizzes.map(q=>(
      <Card key={q.id} className="quiz-row">
        <div className="quiz-row-text">
          <div className="quiz-row-title">{q.title}</div>
          <div className="quiz-row-meta"><Badge type={q.filiere}>{q.filiere==="seconde"?"🏛️ Seconde":q.filiere==="premiere"?"📐 1ère TBAA":"🏗️ Terminale TBAA"}</Badge><span>{q.questions.length} question{q.questions.length>1?"s":""}</span></div>
        </div>
        <div className="btn-row">
          <Btn onClick={()=>setLiveQuiz(q)} sm color="#a16207">📡 Live</Btn>
          <Btn onClick={()=>startQuiz(q)} sm variant="secondary">▶ Solo</Btn>
        </div>
      </Card>
    ))}
  </div>;
}

// ── TUG OF WAR ────────────────────────────────────────────────
function TugOfWar({onAddXP}){
  const [phase,setPhase]=useState("setup");
  const [teamA,setTeamA]=useState("Équipe Bleue");
  const [teamB,setTeamB]=useState("Équipe Rouge");
  const [filiere,setFiliere]=useState("terminale");
  const [questions,setQuestions]=useState(TOW_QS.terminale.map(q=>({...q})));
  const [qIdx,setQIdx]=useState(0);
  const [scoreA,setScoreA]=useState(0);
  const [scoreB,setScoreB]=useState(0);
  const [ropePos,setRopePos]=useState(50);
  const [ansA,setAnsA]=useState("");
  const [ansB,setAnsB]=useState("");
  const [result,setResult]=useState(null);

  // Changement d'écran ou de question : on repart du haut de la page
  useEffect(()=>{window.scrollTo(0,0);},[phase,qIdx]);

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
    }else{setResult({winner:null,answer:q.a});}
  };

  const nextQ=()=>{
    const next=qIdx+1;
    if(next>=questions.length){setPhase("end");return;}
    setQIdx(next);setAnsA("");setAnsB("");setResult(null);
  };

  if(phase==="end"){
    const winner=scoreA===scoreB?null:scoreA>scoreB?teamA:teamB;
    if(winner)onAddXP(XP_GAINS.tug_win,"🏆 Tug of War — victoire !");
    return <div className="result">
      <div className="result-emoji" aria-hidden="true">🎉</div>
      <h1 className="page-title">Fin du match !</h1>
      <div className="result-winner">{scoreA===scoreB?"🤝 Égalité !":scoreA>scoreB?`🏆 ${teamA}`:`🏆 ${teamB}`}</div>
      {winner&&<Callout style={{textAlign:"center",marginBottom:0}}>⭐ +{XP_GAINS.tug_win} XP pour la victoire !</Callout>}
      <div className="result-scores">
        <div><div className="result-score num" style={{color:"#0e7490"}}>{scoreA}</div><div className="hint">{teamA}</div></div>
        <div className="overline" style={{paddingTop:"1rem"}}>VS</div>
        <div><div className="result-score num" style={{color:"#c81e3a"}}>{scoreB}</div><div className="hint">{teamB}</div></div>
      </div>
      <Btn onClick={()=>{setPhase("setup");setQuestions(TOW_QS[filiere].map(q=>({...q})));}}>← Rejouer</Btn>
    </div>;
  }

  if(phase==="play"){
    const q=questions[qIdx];
    return <div>
      <div className="card tow-board">
        <div className="tow-scores">
          <div className="tow-team"><div className="tow-team-name" style={{color:ink("#0e7490")}}>{teamA}</div><div className="tow-score" style={{color:"#0e7490"}}>{scoreA}</div></div>
          <div className="overline">VS</div>
          <div className="tow-team"><div className="tow-team-name" style={{color:ink("#c81e3a")}}>{teamB}</div><div className="tow-score" style={{color:"#c81e3a"}}>{scoreB}</div></div>
        </div>
        <div className="tow-rope" aria-hidden="true">
          <div className="tow-rope-line"/>
          <div className="tow-center"/>
          <div className="tow-knot" style={{left:`${ropePos}%`}}/>
        </div>
        <div className="tow-ends" aria-hidden="true"><span>🏋️</span><span style={{transform:"scaleX(-1)",display:"inline-block"}}>🏋️</span></div>
      </div>
      <div className="card kh-question" style={{marginBottom:"1rem"}}>
        <h1 className="kh-q">{q.q}</h1>
        <div className="page-sub num" style={{marginTop:"0.4rem"}}>Question {qIdx+1}/{questions.length} · <span style={{color:"#166534",fontWeight:600}}>+{XP_GAINS.tug_correct} XP si correct</span></div>
      </div>
      <div className="grid-2" style={{marginBottom:"1rem"}}>
        {[["a",teamA,"#0e7490",ansA,setAnsA],["b",teamB,"#c81e3a",ansB,setAnsB]].map(([team,name,col,val,setVal])=>(
          <div key={team} className="card card-accent tow-answer" style={{"--accent":col}}>
            <label htmlFor={`reponse-${team}`} className="tow-team-name" style={{display:"block",color:ink(col),marginBottom:"0.5rem"}}>{name}</label>
            <input id={`reponse-${team}`} className="field" style={{textAlign:"center",marginBottom:"0.5rem"}} placeholder="Réponse..." autoComplete="off" value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!result)check(team);}}/>
            <Btn onClick={()=>{if(!result)check(team);}} color={col} style={{width:"100%"}} sm disabled={!!result}>Valider ✓</Btn>
          </div>
        ))}
      </div>
      {result&&<>
        <div className="banner" data-tone={result.winner?"ok":"neutral"} role="status">
          {result.winner?`✅ ${result.winner} — +${XP_GAINS.tug_correct} XP !`:`❌ Incorrect !`} — Réponse : <strong>{result.answer}</strong>
        </div>
        <div style={{textAlign:"center"}}><Btn onClick={nextQ}>{qIdx+1<questions.length?"Question suivante →":"Voir le résultat 🏆"}</Btn></div>
      </>}
    </div>;
  }

  return <div>
    <PageHeader icon="🎯" title="Tug of War" subtitle="Le tir à la corde pédagogique"/>
    <Callout>⭐ +{XP_GAINS.tug_correct} XP par bonne réponse · +{XP_GAINS.tug_win} XP pour la victoire</Callout>
    <div className="grid-2 stack-xs" style={{marginBottom:"1.2rem"}}>
      {[["a","Équipe Bleue","#0e7490",teamA,setTeamA],["b","Équipe Rouge","#c81e3a",teamB,setTeamB]].map(([t,placeholder,col,val,setVal])=>(
        <div key={t} className="card card-accent" style={{"--accent":col}}>
          <label htmlFor={`equipe-${t}`} className="label" style={{color:ink(col),fontWeight:700,fontSize:"0.8rem"}}>Équipe {t.toUpperCase()}</label>
          <input id={`equipe-${t}`} className="field" placeholder={placeholder} value={val} onChange={e=>setVal(e.target.value)}/>
        </div>
      ))}
    </div>
    <Card style={{marginBottom:"1.2rem"}}>
      <SectionTitle>❓ Questions</SectionTitle>
      <div className="chip-row" role="group" aria-label="Charger les questions d'une filière" style={{marginBottom:"0.9rem"}}>
        <span className="hint">Filière :</span>
        {[["seconde","🏛️"],["premiere","📐"],["terminale","🏗️"]].map(([k,icon])=><Chip key={k} active={filiere===k} onClick={()=>loadFiliere(k)}>{icon} {FILIERES[k]}</Chip>)}
      </div>
      {questions.map((q,i)=>(
        <div key={i} className="q-row">
          <span className="q-num num" aria-hidden="true">{i+1}</span>
          <div className="grid-2 stack-sm">
            <input className="field" aria-label={`Question ${i+1}`} placeholder="Question..." value={q.q} onChange={e=>updQ(i,"q",e.target.value)}/>
            <input className="field" aria-label={`Bonne réponse à la question ${i+1}`} placeholder="Bonne réponse..." value={q.a} onChange={e=>updQ(i,"a",e.target.value)}/>
          </div>
        </div>
      ))}
      <Btn onClick={addQ} variant="secondary" sm>+ Ajouter une question</Btn>
    </Card>
    <Btn onClick={start} className="btn-lg">🎯 Lancer le jeu !</Btn>
  </div>;
}

// ── CHAMPIONSHIP ──────────────────────────────────────────────
function Championship(){
  const sorted=[...STUDENTS].sort((a,b)=>b.xp-a.xp);
  const champ=[
    {rank:1,name:"Amara D.",classe:"terminale",k:[950,1100,900,1200],total:4150},
    {rank:2,name:"Youssef M.",classe:"terminale",k:[800,900,850,870],total:3420},
    {rank:3,name:"Kevin T.",classe:"premiere",k:[700,750,720,720],total:2890},
    {rank:4,name:"Saliou B.",classe:"seconde",k:[600,700,650,600],total:2550},
    {rank:5,name:"Fatou N.",classe:"premiere",k:[500,600,550,500],total:2150},
  ];
  const [tab,setTab]=useState("live");
  return <div>
    <PageHeader icon="🏆" title="Championnat" subtitle="Classement général"/>
    <div className="tabs" role="group" aria-label="Type de classement">
      <button type="button" className="tab" aria-pressed={tab==="live"} onClick={()=>setTab("live")}>📡 Compétitions live</button>
      <button type="button" className="tab" aria-pressed={tab==="xp"} onClick={()=>setTab("xp")}>⭐ Classement XP</button>
      <button type="button" className="tab" aria-pressed={tab==="kahoot"} onClick={()=>setTab("kahoot")}>🎮 Classement Kahoot</button>
    </div>

    {tab==="live"&&<LiveChampionship/>}

    {tab==="xp"&&<>
      <Card style={{marginBottom:"1rem"}}>
        <SectionTitle>⭐ Podium XP</SectionTitle>
        <div className="podium">
          {[sorted[1],sorted[0],sorted[2]].map((st,i)=>{
            if(!st)return null;
            return <div key={st.name} className="podium-col">
              <div className="podium-who">
                <div className="podium-medal" aria-hidden="true">{["🥈","🥇","🥉"][i]}</div>
                <div className="podium-name">{st.name}</div>
                <div className="podium-xp num">{st.xp} XP</div>
                <XPBadge xp={st.xp}/>
              </div>
              <div className="podium-step num" data-rank={[2,1,3][i]} style={{height:[64,92,44][i]}}>{[2,1,3][i]}</div>
            </div>;
          })}
        </div>
      </Card>
      <Card>
        <SectionTitle>📋 Classement XP complet</SectionTitle>
        {sorted.map((st,i)=>{
          const {current}=getLevelInfo(st.xp);
          return <div key={st.name} className="rank-row">
            <div className="rank-pos">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
            <Avatar name={st.name}/>
            <div className="rank-who"><div className="rank-name">{st.name}</div><XPBadge xp={st.xp}/></div>
            <div className="rank-xp num">{st.xp}<small>XP</small></div>
          </div>;
        })}
      </Card>
    </>}

    {tab==="kahoot"&&<>
      <div className="stats">
        {[["4/10","#a16207","Kahoots joués"],["18","#15803d","Participants"],["6","#6d28d9","Kahoots restants"]].map(([v,col,label])=>(
          <Card key={label} className="stat"><div className="stat-val" style={{color:col}}>{v}</div><div className="overline stat-label">{label}</div></Card>
        ))}
      </div>
      <Card>
        <SectionTitle>📋 Classement Kahoot</SectionTitle>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau du classement Kahoot">
          <table className="table">
            <thead><tr>{["#","Élève","Classe","K1","K2","K3","K4","Total"].map(h=><th key={h} scope="col" className={/^K\d$|^Total$/.test(h)?"r":undefined}>{h}</th>)}</tr></thead>
            <tbody>
              {champ.map(st=>(
                <tr key={st.name}>
                  <td className="num" style={{color:"#854d0e",fontWeight:700}}>{st.rank===1?"🥇":st.rank===2?"🥈":st.rank===3?"🥉":st.rank}</td>
                  <td className="cell-name">{st.name}</td>
                  <td><Badge type={st.classe}>{st.classe==="seconde"?"🏛️ Seconde":st.classe==="premiere"?"📐 1ère TBAA":"🏗️ Term TBAA"}</Badge></td>
                  {st.k.map((k,i)=><td key={i} className="r num">{k}</td>)}
                  <td className="r num" style={{fontWeight:700,color:"#854d0e"}}>{st.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>}
  </div>;
}

// ── MOODLE ────────────────────────────────────────────────────
function Moodle(){
  return <div>
    <PageHeader icon="🎓" title="Éléa — Moodle"/>
    {[
      {color:"#0e7490",title:"🎓 Qu'est-ce qu'Éléa ?",content:"Éléa est la plateforme Moodle officielle de l'Éducation Nationale. En tant qu'enseignant à l'académie de Versailles, vous avez droit à un espace gratuit avec suivi des élèves, dépôt de fichiers, quiz et forums."},
      {color:"#15803d",title:"✅ Comment obtenir votre espace",steps:["Connectez-vous sur elea.ac-versailles.fr avec vos identifiants académiques","Si pas d'accès → contactez votre référent numérique ou chef d'établissement","Formation gratuite disponible via la DANE de Versailles","Une fois créé → transférez toutes vos ressources depuis ce site"]},
      {color:"#a16207",title:"💡 En attendant Moodle",content:"Ce site fonctionne déjà ! Partagez-le à vos élèves via un simple lien. Accessible depuis n'importe quel téléphone ou ordinateur, sans installation."},
    ].map(({color,title,content,steps})=>(
      <section key={title} className="note" style={{"--accent":color}}>
        <h2 className="note-title">{title}</h2>
        {content&&<p className="note-text">{content}</p>}
        {steps&&<ol className="steps">{steps.map((step,i)=>(
          <li key={i}>
            <span className="step-num" style={tone(color)} aria-hidden="true">{i+1}</span>
            <span>{step}</span>
          </li>
        ))}</ol>}
      </section>
    ))}
  </div>;
}

// ── APP SHELL ─────────────────────────────────────────────────
export default function App(){
  // Page élève du quiz live : accessible sans connexion
  if(window.location.pathname.startsWith("/jouer")) return <LiveJoin/>;
  return <AppShell/>;
}

function AppShell(){
  const [user,setUser]=useState(null);
  const [active,setActive]=useState("dashboard");
  const [toasts,setToasts]=useState([]);
  const [levelUp,setLevelUp]=useState(null);
  const [menuOpen,setMenuOpen]=useState(false);

  // Menu repliable (tablette / téléphone) : fermeture avec Échap…
  useEffect(()=>{
    if(!menuOpen) return;
    const onKey=e=>{if(e.key==="Escape")setMenuOpen(false);};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[menuOpen]);

  // … et dès que la fenêtre repasse en largeur « ordinateur » (la barre latérale redevient fixe)
  useEffect(()=>{
    const desktop=window.matchMedia("(min-width: 900px)");
    const onChange=()=>{if(desktop.matches)setMenuOpen(false);};
    desktop.addEventListener("change",onChange);
    return()=>desktop.removeEventListener("change",onChange);
  },[]);

  // Changement de page : on repart du haut
  useEffect(()=>{window.scrollTo(0,0);},[active]);

  // Sync XP to Supabase
  const syncXP=async(userId,newXP)=>{
    if(!userId) return;
    await supabase.from("profiles").update({xp:newXP}).eq("id",userId);
  };

  const addXP=async(gain,label)=>{
    if(!user||user.role==="prof") return;
    const oldXP=user.xp||0;
    const newXP=oldXP+gain;
    const oldLevel=getLevelInfo(oldXP).current.level;
    const newLevel=getLevelInfo(newXP).current.level;
    setUser(prev=>({...prev,xp:newXP}));
    const id=Date.now()+Math.random();
    setToasts(prev=>[...prev,{id,gain,label}]);
    if(newLevel>oldLevel){
      const lvlInfo=getLevelInfo(newXP).current;
      setTimeout(()=>setLevelUp(lvlInfo),600);
    }
    // Sync to database
    if(user.id) await syncXP(user.id,newXP);
  };

  const removeToast=(id)=>setToasts(prev=>prev.filter(t=>t.id!==id));

  const handleLogout=async()=>{
    await supabase.auth.signOut();
    setUser(null);
  };

  if(!user) return <Login onLogin={u=>{ setUser(u); setActive("dashboard"); }}/>;

  const panels={
    dashboard:<Dashboard user={user} onAddXP={addXP}/>,
    classes:<Classes/>,
    notes:<Notes/>,
    roster:<Roster/>,
    kahoot:<Kahoot onAddXP={addXP}/>,
    tugofwar:<TugOfWar onAddXP={addXP}/>,
    championship:<Championship/>,
    xp:<XPPage user={user} onAddXP={addXP}/>,
    moodle:<Moodle/>
  };

  return <div className="app">
    <a className="skip-link" href="#contenu">Aller au contenu</a>

    {/* Toasts XP */}
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t=><XPToast key={t.id} gain={t.gain} label={t.label} onDone={()=>removeToast(t.id)}/>)}
    </div>

    {/* Level up modal */}
    {levelUp&&<LevelUpModal level={levelUp} onClose={()=>setLevelUp(null)}/>}

    {/* Header */}
    <header className="app-header">
      <div className="header-left">
        <button type="button" className="menu-toggle" aria-expanded={menuOpen} aria-controls="menu-principal" aria-label={menuOpen?"Fermer le menu":"Ouvrir le menu"} onClick={()=>setMenuOpen(o=>!o)}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d={menuOpen?"M4 4l10 10M14 4L4 14":"M2 4.5h14M2 9h14M2 13.5h14"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span className="menu-toggle-label">Menu</span>
        </button>
        <div className="brand">
          <Logo size={36}/>
          <div className="brand-name">Pro<span>Lycée</span></div>
          <div className="overline brand-tagline">Plateforme pédagogique</div>
        </div>
      </div>
      <div className="header-right">
        {user.role==="eleve"&&(
          <div className="xp-pill" title="Mes points d'expérience">
            <span aria-hidden="true">⭐</span>
            <b className="num">{user.xp||0}</b>
            <small>XP</small>
            <span className="xp-pill-level" aria-hidden="true">{getLevelInfo(user.xp||0).current.icon}</span>
          </div>
        )}
        <div className="user-pill" title={user.name}>
          {user.role==="prof"?"👨‍🏫":"👨‍🎓"} {user.name}
        </div>
        <button type="button" onClick={handleLogout} className="btn btn-secondary btn-sm header-logout">Déconnexion</button>
      </div>
    </header>

    <div className="app-body">
      <Sidebar active={active} setActive={setActive} user={user} open={menuOpen} onClose={()=>setMenuOpen(false)} onLogout={()=>{setMenuOpen(false);handleLogout();}}/>
      <main id="contenu" className="app-main" tabIndex={-1} inert={menuOpen}>
        <div className="app-container">
          {panels[active]||panels.dashboard}
        </div>
      </main>
    </div>
  </div>;
}
