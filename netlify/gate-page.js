// Pages servies par le portail avant connexion (aucune ressource externe : tout est intégré).
const css = `
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f1e7;color:#1f2430;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{width:min(92vw,380px);background:#fff;border:1px solid #e4dccb;border-top:4px solid #8c2d3a;border-radius:14px;padding:28px 24px;box-shadow:0 10px 30px rgba(60,30,30,.08)}
h1{margin:0 0 2px;font:700 28px Georgia,serif;text-align:center;color:#1f2430}h1 span{color:#8c2d3a}
.sub{text-align:center;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8c2d3a;margin-bottom:20px}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#f3eee3;border-radius:10px;padding:4px;margin-bottom:16px}
.seg label{text-align:center;padding:8px;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px}
.seg input{position:absolute;opacity:0}.seg input:checked+span{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12);display:block;border-radius:8px;margin:-8px;padding:8px}
label.f{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5b6472;margin-bottom:6px}
input[type=password],input[type=text]{width:100%;padding:12px;border:1px solid #d6cdb9;border-radius:8px;background:#faf7f0;font-size:16px}
input:focus{outline:2px solid #8c2d3a;outline-offset:1px}
button{width:100%;margin-top:16px;padding:13px;border:0;border-radius:8px;background:#8c2d3a;color:#fff;font-weight:700;font-size:16px;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}.err{margin-top:12px;padding:10px 12px;border-radius:8px;background:#fdecec;color:#8a1f1f;font-size:14px}
`;
export const loginPage = () => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>ProLycée — Connexion</title><style>${css}</style></head><body>
<main><h1>Pro<span>Lycée</span></h1><div class="sub">Plateforme pédagogique</div>
<form id="f" autocomplete="off">
<div class="seg" role="radiogroup" aria-label="Type d'accès">
<label><input type="radio" name="role" value="eleve" checked><span>👨‍🎓 Élève</span></label>
<label><input type="radio" name="role" value="prof"><span>👨‍🏫 Professeur</span></label></div>
<label class="f" for="code" id="lab">Code de la classe</label>
<input id="code" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required>
<div id="err" class="err" role="alert" hidden></div>
<button id="go" type="submit">Entrer →</button></form></main>
<script>
const f=document.getElementById('f'),code=document.getElementById('code'),err=document.getElementById('err'),go=document.getElementById('go'),lab=document.getElementById('lab');
const role=()=>f.role.value;
f.addEventListener('change',()=>{lab.textContent=role()==='prof'?'Code professeur':'Code de la classe';err.hidden=true;});
f.addEventListener('submit',async(e)=>{e.preventDefault();err.hidden=true;go.disabled=true;
 try{const r=await fetch('/_gate/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role:role(),code:code.value})});
  const d=await r.json().catch(()=>({}));
  if(d.ok){try{sessionStorage.setItem('pl_boot',JSON.stringify({role:d.role,code:code.value}));}catch(_){}location.replace(location.pathname+location.search);return;}
  err.textContent=d.locked?'Trop d’essais. Réessaie dans 10 minutes.':(r.status>=500?'Connexion impossible pour le moment, réessaie.':'Code incorrect.');
 }catch(_){err.textContent='Connexion impossible pour le moment, réessaie.';}
 err.hidden=false;go.disabled=false;code.select();});
</script></body></html>`;
export const notConfiguredPage = () => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ProLycée</title><style>${css}</style></head><body><main><h1>Pro<span>Lycée</span></h1><div class="sub">Accès fermé</div><p>Le portail n’est pas encore configuré (variable GATE_SECRET manquante). Le site reste fermé par sécurité.</p></main></body></html>`;
