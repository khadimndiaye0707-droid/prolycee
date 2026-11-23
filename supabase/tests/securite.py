import subprocess, json, sys
PSQL=["psql","-q","-At","-h","/tmp/pgtest","-p","54329","-U","postgres","-d","t"]
def run(sql, role=None, uid=None, ip=None):
    pre=""
    if role: pre+=f"set role {role};"
    if uid: pre+=f"set request.jwt.claim.sub='{uid}';"
    if ip: pre+=f"""set request.headers='{{"x-forwarded-for":"{ip}"}}';"""
    r=subprocess.run(PSQL+["-c",pre+sql],capture_output=True,text=True)
    out=(r.stdout+r.stderr).strip()
    return out
fails=0
def check(name, got, cond):
    global fails
    ok = cond(got) if callable(cond) else (cond in got)
    print(("OK   " if ok else "FAIL ")+name+("" if ok else f"\n     -> {got!r}"))
    if not ok: fails+=1
A="00000000-0000-0000-0000-00000000000a"  # visiteur (session anonyme sans code)
B="00000000-0000-0000-0000-00000000000b"  # élève 1
C="00000000-0000-0000-0000-00000000000c"  # élève 2
P="00000000-0000-0000-0000-0000000000a1"  # prof
P2="00000000-0000-0000-0000-0000000000a2" # prof, autre appareil
PROF="Prof-Secret-2026!"; ELEVE="Classe-2026"
adm=lambda s: run(s)
adm("truncate access_grants, access_attempts, live_answers, live_players, live_games, quizzes, roster cascade; delete from app_config where key='student_code'; update app_config set value='MON-CODE-PROF' where key='prof_secret';")
adm("insert into live_games(pin,titre,mode,total) values ('123456','Secret','revision',1);")
adm("insert into quizzes(titre,questions) values ('Quiz secret','[]');")
adm("insert into storage.objects(bucket_id,name) values ('quiz-media','plan.webp');")

print("== 0. Code d'exemple interdit")
check("prof placeholder refusé", run("select redeem_code('MON-CODE-PROF','prof')",'authenticated',P), '"ok": false')
adm(f"update app_config set value='{PROF}' where key='prof_secret';")

print("== 1. Visiteur sans session (anon)")
for t in ["live_games","live_players","live_answers","quizzes","roster","app_config","access_grants","live_totals","championnat","profiles","live_secrets"]:
    check(f"anon ne lit pas {t}", run(f"select count(*) from {t}",'anon'), "permission denied")
check("anon: host_roster_list refusé", run(f"select * from host_roster_list('{PROF}')",'anon'), "Accès refusé")
check("anon: join_game refusé", run("select * from join_game('123456','','x')",'anon'), "Accès refusé")
check("anon: redeem impossible (pas de session)", run(f"select redeem_code('{ELEVE}','eleve')",'anon'), "Session requise")
check("anon: storage illisible (0 ligne)", run("select count(*) from storage.objects",'anon'), lambda g: g.strip()=="0" or "permission denied" in g)
check("anon: oracle _check_prof fermé", run(f"select _check_prof('{PROF}')",'anon'), "permission denied")
check("anon: _secret fermé", run("select _secret('prof')",'anon'), "permission denied")

print("== 2. Session anonyme Supabase SANS code (authenticated, aucun droit)")
check("0 partie visible", run("select count(*) from live_games",'authenticated',A), "0")
check("0 quiz (permission)", run("select count(*) from quizzes",'authenticated',A), "permission denied")
check("0 stockage", run("select count(*) from storage.objects",'authenticated',A), "0")
check("my_access null", run("select my_access()",'authenticated',A), lambda g: g=="" )
check("join_game refusé", run("select * from join_game('123456','','x')",'authenticated',A), "Accès refusé")
check("host_quiz_list refusé (code prof juste)", run(f"select * from host_quiz_list('{PROF}')",'authenticated',A), "Accès refusé")
check("host_set_student_code refusé", run(f"select host_set_student_code('{PROF}','abcdef12')",'authenticated',A), "Accès refusé")
check("upload refusé", run("insert into storage.objects(bucket_id,name) values ('quiz-media','x')",'authenticated',A), lambda g:"row-level security" in g or "permission" in g)
check("élève: pas encore de code élève défini → refusé", run(f"select redeem_code('{ELEVE}','eleve')",'authenticated',A), '"ok": false')

print("== 3. Prof")
check("prof redeem ok", run(f"select redeem_code('{PROF}','prof')",'authenticated',P,"1.1.1.1"), '"ok": true')
check("my_access prof", run("select my_access()",'authenticated',P), '"role": "prof"')
check("prof lit les quiz", run(f"select count(*) from host_quiz_list('{PROF}')",'authenticated',P), "1")
check("code élève trop court refusé", run(f"select host_set_student_code('{PROF}','abc')",'authenticated',P), "au moins 6")
check("code élève = code prof refusé", run(f"select host_set_student_code('{PROF}','{PROF}')",'authenticated',P), "différent")
check("prof définit le code élève", run(f"select host_set_student_code('{PROF}','{ELEVE}')",'authenticated',P), lambda g: "ERROR" not in g)
check("prof relit le code élève", run(f"select host_get_student_code('{PROF}')",'authenticated',P), ELEVE)
check("prof: mauvais code prof refusé", run("select host_get_student_code('mauvais')",'authenticated',P), "Code prof incorrect")
r=run(f"select (host_roster_add('{PROF}','terminale','Awa')).code",'authenticated',P)
check("prof ajoute un élève (code perso 4 car.)", r, lambda g: len(g)==4); CODE=r
r2=run(f"select (host_roster_add('{PROF}','premiere','Moussa')).code",'authenticated',P); CODE2=r2
check("prof upload ok", run("insert into storage.objects(bucket_id,name) values ('quiz-media','prof.webp')",'authenticated',P), lambda g:"ERROR" not in g)

print("== 4. Élève (code commun)")
check("élève: mauvais code", run("select redeem_code('nimporte','eleve')",'authenticated',B,"2.2.2.2"), '"ok": false')
check("élève: code prof sur onglet élève refusé", run(f"select redeem_code('{PROF}','eleve')",'authenticated',B,"2.2.2.2"), '"ok": false')
check("élève: code élève sur rôle prof refusé", run(f"select redeem_code('{ELEVE}','prof')",'authenticated',B,"2.2.2.2"), '"ok": false')
check("élève redeem ok (majuscules ignorées)", run(f"select redeem_code(' classe-2026 ','eleve')",'authenticated',B,"2.2.2.2"), '"ok": true')
check("my_access élève non identifié", run("select my_access()",'authenticated',B), '"identified": false')
check("élève voit les parties", run("select count(*) from live_games",'authenticated',B), "1")
check("élève: fonctions prof refusées MÊME avec le bon code prof", run(f"select * from host_roster_list('{PROF}')",'authenticated',B), "Accès refusé")
check("élève: host_quiz_list refusé", run(f"select * from host_quiz_list('{PROF}')",'authenticated',B), "Accès refusé")
check("élève: lire le code élève via prof refusé", run(f"select host_get_student_code('{PROF}')",'authenticated',B), "Accès refusé")
check("élève: changer le code élève refusé", run(f"select host_set_student_code('{PROF}','hack1234')",'authenticated',B), "Accès refusé")
check("élève: changer le code prof refusé", run(f"select host_set_prof_secret('{PROF}','pirate-code-12345')",'authenticated',B), "Accès refusé")
check("élève: créer une partie refusé", run(f"select * from host_create_game('{PROF}','x','revision','',1)",'authenticated',B), "Accès refusé")
check("élève: écrire dans live_games refusé", run("update live_games set titre='x'",'authenticated',B), "permission denied")
check("élève: lire roster refusé", run("select * from roster",'authenticated',B), "permission denied")
check("élève: lire app_config refusé", run("select * from app_config",'authenticated',B), "permission denied")
check("élève: lire access_grants refusé", run("select * from access_grants",'authenticated',B), "permission denied")
check("élève: upload refusé", run("insert into storage.objects(bucket_id,name) values ('quiz-media','e.webp')",'authenticated',B), lambda g:"row-level security" in g)
check("élève lit le stockage", run("select count(*) from storage.objects",'authenticated',B), lambda g: g.strip().isdigit() and int(g)>=1)
check("code perso inconnu refusé", run("select set_identity('ZZZZ','','')",'authenticated',B), "Code personnel inconnu")
check("identité par code perso", run(f"select set_identity('{CODE.lower()}','','')",'authenticated',B), '"nom": "Awa"')
check("add_xp +100", run("select add_xp(100)",'authenticated',B), "100")
check("add_xp plafonné à 500/appel", run("select add_xp(99999)",'authenticated',B), "600")
check("add_xp négatif ignoré", run("select add_xp(-50)",'authenticated',B), "600")
check("progression retrouvée (autre appareil, même code perso)", run(f"select redeem_code('{ELEVE}','eleve')",'authenticated',C,"3.3.3.3")+run(f"select set_identity('{CODE}','','')",'authenticated',C), '"xp": 600')
check("invité sans code perso: prénom+classe", run("select set_identity('','Fatou','seconde')",'authenticated',B), lambda g:'"roster": false' in g and "Fatou" in g)
check("invité: pas de XP sauvegardé", run("select add_xp(100)",'authenticated',B), lambda g: g=="")
run(f"select set_identity('{CODE}','','')",'authenticated',B)

print("== 5. Quiz live : propriétaire du joueur")
g=run(f"select pin from host_create_game('{PROF}','Test','competition','',1)",'authenticated',P)
check("prof crée une partie", g, lambda x: len(x)==6); PIN=g
check("élève rejoint", run(f"select player_id from join_game('{PIN}','{CODE}','')",'authenticated',B), lambda x: len(x)==36)
pid=run(f"select id from live_players limit 1")
run(f"select host_set_question('{PROF}',(select id from live_games where pin='{PIN}'),0,'{{}}')",'authenticated',P)
check("autre élève ne peut pas répondre pour lui", run(f"select submit_answer('{pid}',0,1,500)",'authenticated',C)+run("select count(*) from live_answers"), lambda x: x.strip().endswith("0"))
check("le propriétaire répond", run(f"select submit_answer('{pid}',0,1,500)",'authenticated',B)+run("select count(*) from live_answers"), lambda x: x.strip().endswith("1"))
check("visiteur sans droit: submit refusé", run(f"select submit_answer('{pid}',0,1,500)",'authenticated',A), "Accès refusé")
check("championnat visible aux membres", run("select count(*) from live_totals",'authenticated',B), lambda x: x.strip().isdigit())
check("championnat vide pour non-membre", run("select count(*) from live_totals",'authenticated',A), "0")

print("== 6. Révocation : changement du code élève")
check("avant: B est membre", run("select my_access()",'authenticated',B), '"role": "eleve"')
check("prof change le code élève", run(f"select host_set_student_code('{PROF}','Nouveau-Code-77')",'authenticated',P), lambda g:"ERROR" not in g)
check("après: B n'a plus aucun droit", run("select my_access()",'authenticated',B), lambda g: g=="")
check("après: B ne lit plus les parties", run("select count(*) from live_games",'authenticated',B), "0")
check("après: C aussi révoqué", run("select my_access()",'authenticated',C), lambda g: g=="")
check("après: B ne lit plus le stockage", run("select count(*) from storage.objects",'authenticated',B), "0")
check("après: B ne peut plus rejoindre", run(f"select * from join_game('{PIN}','{CODE}','')",'authenticated',B), "Accès refusé")
check("ancien code refusé", run(f"select redeem_code('{ELEVE}','eleve')",'authenticated',B,"2.2.2.2"), '"ok": false')
check("prof toujours connecté", run("select my_access()",'authenticated',P), '"role": "prof"')
check("nouveau code accepté", run("select redeem_code('nouveau-code-77','eleve')",'authenticated',B,"2.2.2.2"), '"ok": true')
check("retour à l'ancien code: pas de résurrection auto", run("select my_access()",'authenticated',C), lambda g: g=="")
print("== 6 bis. Révocation même par modification directe en SQL")
adm("update app_config set value='Encore-Un-Autre-9' where key='student_code';")
check("B révoqué (empreinte ne correspond plus)", run("select my_access()",'authenticated',B), lambda g: g=="")
adm("update app_config set value='Nouveau-Code-77' where key='student_code';")

print("== 7. Changement du code prof")
check("2e appareil prof connecté", run(f"select redeem_code('{PROF}','prof')",'authenticated',P2,"4.4.4.4"), '"ok": true')
NEW="Nouveau-Prof-Code-2027"
check("code prof trop court refusé", run(f"select host_set_prof_secret('{PROF}','court')",'authenticated',P), "au moins 12")
check("code prof = code élève refusé", run(f"select host_set_prof_secret('{PROF}','Nouveau-Code-77')",'authenticated',P), "différent")
check("prof change son code", run(f"select host_set_prof_secret('{PROF}','{NEW}')",'authenticated',P), lambda g:"ERROR" not in g)
check("autre appareil prof déconnecté", run("select my_access()",'authenticated',P2), lambda g: g=="")
check("appareil courant reste prof", run("select my_access()",'authenticated',P), '"role": "prof"')
check("ancien code prof refusé", run(f"select redeem_code('{PROF}','prof')",'authenticated',P2,"4.4.4.4"), '"ok": false')
check("nouveau code prof accepté", run(f"select redeem_code('{NEW}','prof')",'authenticated',P2,"4.4.4.4"), '"ok": true')
PROF=NEW

print("== 8. Anti-essais (brute force)")
for i in range(8): run("select redeem_code('faux','eleve')",'authenticated',A,"9.9.9.9")
check("8 échecs → bloqué", run("select redeem_code('faux','eleve')",'authenticated',A,"9.9.9.9"), '"locked": true')
check("même le bon code est bloqué pendant 10 min", run("select redeem_code('nouveau-code-77','eleve')",'authenticated',A,"9.9.9.9"), '"locked": true')
check("autre IP non touchée", run("select redeem_code('nouveau-code-77','eleve')",'authenticated',A,"8.8.8.8"), '"ok": true')
for i in range(8): run("select set_identity('QQQQ','','')",'authenticated',B,"7.7.7.7")
check("code perso : blocage anti-devinette", run("select set_identity('QQQQ','','')",'authenticated',B,"7.7.7.7"), "Trop d")
check("blocage ne touche pas le prof legit (autre IP)", run(f"select * from host_roster_list('{PROF}')",'authenticated',P2), lambda g:"Awa" in g)

print("== 9. Portail Netlify (gate)")
key=adm("select value from app_config where key='gate_key'")
check("gate_login mauvaise clé", run("select gate_login('x','eleve','nouveau-code-77','5.5.5.5')",'anon'), '"ok": false')
check("gate_login bon code", run(f"select gate_login('{key}','eleve','nouveau-code-77','5.5.5.5')",'anon'), '"ok": true')
check("gate_login empreinte renvoyée", run(f"select gate_login('{key}','prof','{PROF}','5.5.5.5')",'anon'), '"fp"')
check("gate_login mauvais code", run(f"select gate_login('{key}','eleve','faux','5.5.5.5')",'anon'), '"ok": false')
for i in range(8): run(f"select gate_login('{key}','eleve','faux','6.6.6.6')",'anon')
check("gate: blocage par IP client", run(f"select gate_login('{key}','eleve','nouveau-code-77','6.6.6.6')",'anon'), '"locked": true')
check("gate_versions sans clé = null", run("select gate_versions('x')",'anon'), lambda g: g=="")
v=run(f"select gate_versions('{key}')",'anon')
check("gate_versions avec clé", v, '"eleve"')
run(f"select host_set_student_code('{PROF}','Quatrieme-Code-5')",'authenticated',P)
check("gate_versions change quand le code élève change", run(f"select gate_versions('{key}')",'anon'), lambda g: g!=v)
check("gate_key illisible depuis le site", run("select value from app_config where key='gate_key'",'authenticated',P), "permission denied")

print("== 10. Anciens profils e-mail")
check("profiles illisible (anon)", run("select count(*) from profiles",'anon'), "permission denied")
check("profiles illisible (authenticated)", run("select count(*) from profiles",'authenticated',P), "permission denied")

print("== 11. Code prof d'exemple remis")
adm("update app_config set value='MON-CODE-PROF' where key='prof_secret';")
check("prof déconnecté si code = exemple", run("select my_access()",'authenticated',P), lambda g: g=="")
print("\nÉCHECS:",fails); sys.exit(1 if fails else 0)
