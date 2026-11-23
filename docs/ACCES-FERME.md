# ProLycée — site fermé, accès par codes

Sans code valide, un visiteur ne voit que l'écran de connexion : ni pages, ni scripts, ni images, ni données,
même avec un lien direct. Deux verrous indépendants :

1. **Portail Netlify** (`netlify/`) : bloque tout le site (pages, scripts, images) tant que le cookie signé n'est pas valide.
2. **Supabase** (`supabase/live_schema.sql`) : les données (quiz, parties live, classement, liste de classe, médias)
   ne sont lisibles qu'avec une autorisation créée par un code valide. Les droits sont vérifiés par la base, pas par l'écran.

## Les codes

| Code | Qui | Donne accès à |
|---|---|---|
| Code **professeur** (personnel, 12 caractères ou plus) | toi | tout, dont l'administration |
| Code **élève** (commun à la classe, 6 caractères ou plus) | tes élèves | le site côté élève ; **jamais** les fonctions prof |
| Code **personnel** de l'élève (4 caractères, liste de classe) | chaque élève | retrouver sa progression (XP) sur tous ses appareils |

- Aucune inscription publique, aucun e-mail demandé.
- Changer le **code élève** (page « Élèves & codes → Accès au site ») déconnecte aussitôt tous les élèves
  qui avaient l'ancien ; les anciens cookies du portail tombent en moins de 15 secondes.
- Changer le **code prof** déconnecte les autres appareils prof. Même une modification directe dans la base révoque les accès.
- 8 essais ratés en 10 minutes bloquent l'appelant 10 minutes (portail, écran de connexion, code personnel).

## Mise en route (dans cet ordre)

### 1. Supabase
1. **Authentication → Sign In / Providers** : activer **Allow anonymous sign-ins** (sert de session invisible par appareil, sans e-mail) ; désactiver les inscriptions par **Email**.
2. **SQL Editor → New query** : coller tout `supabase/live_schema.sql`, **Run**. (Relançable sans risque : garde tes quiz et ta liste de classe.)
3. Nouvelle requête, avec ton vrai code prof (12 caractères ou plus) :
   `update app_config set value = 'TON-CODE-PROF' where key = 'prof_secret';`
4. Nouvelle requête : `select value from app_config where key = 'gate_key';` → copie la valeur (64 caractères).

### 2. Netlify
1. **Site configuration → Environment variables** : ajouter `GATE_SECRET` = la valeur copiée (toutes les portées).
2. Fusionner la branche : Netlify publie. Tant que `GATE_SECRET` manque, le site reste fermé avec un message « portail non configuré ».

### 3. Premier usage
1. Ouvre le site → onglet **Professeur** → ton code prof.
2. **Élèves & codes → Accès au site** : choisis (ou génère) le code élève, donne-le à ta classe.
3. Les élèves : onglet **Élève** → code de la classe → leur code personnel (ou prénom + classe sans sauvegarde).

## Tests
- `npm run test:portail` : portail (cookie, révocation, liens directs).
- `supabase/tests/securite.py` : droits côté base (visiteur, élève, prof, révocation, anti-essais) sur un Postgres local
  (`mock_supabase.sql` simule les rôles Supabase).
