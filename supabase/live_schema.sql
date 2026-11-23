-- ════════════════════════════════════════════════════════════════
--  ProLycée — Base de données : quiz live, quiz BTP, ACCÈS FERMÉ PAR CODES
--  À coller dans Supabase > SQL Editor > New query > Run.
--  Ce script peut être relancé sans risque (même s'il a déjà été exécuté) :
--  il garde tes codes, ta liste de classe et tes quiz.
--
--  Principe : rien n'est lisible sans code valide. Deux codes :
--    • le code PROF (personnel)  → administration
--    • le code ÉLÈVE (commun)    → entrée sur le site, jamais les fonctions prof
--  Les droits sont vérifiés ICI, côté serveur (règles RLS + fonctions).
--  Changer un code révoque tout de suite tous les accès obtenus avec l'ancien.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Configuration et codes ────────────────────────────────────
create table if not exists app_config (key text primary key, value text not null);
alter table app_config enable row level security;   -- aucune policy = illisible depuis le site

-- Code prof : remplace MON-CODE-PROF par ton vrai code (12 caractères ou plus) AVANT de lancer.
-- Tant qu'il vaut « MON-CODE-PROF », la connexion prof est refusée (code d'exemple interdit).
insert into app_config (key, value) values ('prof_secret', 'MON-CODE-PROF')
  on conflict (key) do nothing;
-- Clé serveur aléatoire : sert à la fois à signer le portail Netlify et à masquer les empreintes des codes.
insert into app_config (key, value) values ('gate_key', encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (key) do nothing;

-- ── 2. Tables ────────────────────────────────────────────────────
create table if not exists roster (                  -- liste de classe + code personnel
  id uuid primary key default gen_random_uuid(),
  classe text not null check (classe in ('seconde','premiere','terminale')),
  nom text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists live_games (
  id uuid primary key default gen_random_uuid(),
  pin text not null,
  titre text not null,
  mode text not null check (mode in ('competition','revision')),
  classe text,                                       -- null = ouvert à toutes les classes
  status text not null default 'lobby' check (status in ('lobby','question','reveal','finished')),
  q_index int not null default -1,
  total int not null default 0,
  question jsonb,                                    -- question en cours SANS la bonne réponse
  correct int,                                       -- renseignée seulement à la correction
  q_started_at timestamptz,
  created_at timestamptz not null default now()
);
alter table live_games add column if not exists reveal jsonb;   -- bonne réponse affichée à la correction
create unique index if not exists live_games_pin_actif on live_games (pin) where status <> 'finished';

create table if not exists live_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references live_games(id) on delete cascade,
  roster_id uuid references roster(id) on delete set null,
  nom text not null,
  created_at timestamptz not null default now(),
  unique (game_id, roster_id)
);

create table if not exists live_answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references live_games(id) on delete cascade,
  player_id uuid not null references live_players(id) on delete cascade,
  q_index int not null,
  choice int not null,
  ms int not null,
  correct boolean,
  points int not null default 0,
  created_at timestamptz not null default now(),
  unique (player_id, q_index)
);

alter table live_answers alter column choice drop not null;
alter table live_answers add column if not exists x numeric;      -- clic sur le plan (0 à 1)
alter table live_answers add column if not exists y numeric;
alter table live_answers add column if not exists value numeric;  -- réponse numérique

alter table roster add column if not exists xp int not null default 0;          -- progression de l'élève
alter table live_players add column if not exists owner uuid;                    -- session qui joue ce joueur

-- Quiz sauvegardés (contiennent les bonnes réponses : lisibles uniquement avec le code prof)
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  classe text,
  theme text,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table quizzes enable row level security;

-- ── 2 bis. Accès fermé : sessions, codes, empreintes, anti-essais ─────────
-- Chaque appareil reçoit une session anonyme Supabase (aucun e-mail). Elle ne donne AUCUN droit
-- tant que le bon code n'a pas été saisi : le code valide crée une « autorisation » (access_grants).
-- L'autorisation porte l'empreinte du code utilisé : si le code change, elle devient invalide.

create table if not exists access_grants (
  user_id uuid primary key,
  role text not null check (role in ('prof','eleve')),
  fp text not null,                                  -- empreinte (HMAC) du code utilisé
  roster_id uuid references roster(id) on delete set null,   -- identité de l'élève (code personnel)
  guest_nom text,                                    -- élève sans code personnel : prénom et classe
  guest_classe text check (guest_classe in ('seconde','premiere','terminale')),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table access_grants enable row level security;

create table if not exists access_attempts (
  id bigserial primary key,
  who text not null,
  at timestamptz not null default now()
);
create index if not exists access_attempts_who_at on access_attempts (who, at);
alter table access_attempts enable row level security;

revoke all on app_config, roster, access_grants, access_attempts from anon, authenticated;
revoke all on sequence access_attempts_id_seq from anon, authenticated;

-- Code « utilisable » : null si absent ou si c'est encore le code d'exemple.
create or replace function _secret(p_role text) returns text
language sql stable security definer set search_path = public as $$
  select case p_role
    when 'prof'  then nullif((select value from app_config where key = 'prof_secret'), 'MON-CODE-PROF')
    when 'eleve' then (select value from app_config where key = 'student_code')
  end
$$;

-- Normalisation : le code élève ignore majuscules et espaces autour ; le code prof est exact.
create or replace function _norm(p_role text, p_code text) returns text
language sql immutable as $$
  select case when p_role = 'eleve' then lower(trim(coalesce(p_code, ''))) else trim(coalesce(p_code, '')) end
$$;

-- Empreinte d'un code (HMAC avec la clé serveur) : ne permet pas de retrouver le code.
create or replace function _fp(p_role text, p_code text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case when p_code is null then null else
    encode(hmac(convert_to(_norm(p_role, p_code), 'utf8'),
                convert_to((select value from app_config where key = 'gate_key'), 'utf8'), 'sha256'), 'hex') end
$$;

-- Rôle de la session courante, ou null si elle n'a pas (ou plus) de droit.
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select g.role from access_grants g
  where g.user_id = auth.uid() and g.fp = _fp(g.role, _secret(g.role))
$$;
create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(my_role() is not null, false) $$;
create or replace function is_prof() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(my_role() = 'prof', false) $$;

-- Identifiant de l'appelant pour limiter les essais (IP réelle si disponible).
create or replace function _who() returns text
language sql stable as $$
  select coalesce(
    nullif(trim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'uid:' || coalesce(auth.uid()::text, 'anon'))
$$;

-- Teste un code. 8 essais ratés en 10 minutes bloquent l'appelant 10 minutes.
create or replace function _try_code(p_role text, p_code text, p_who text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_expected text := _secret(p_role); v_in text := _norm(p_role, p_code);
begin
  if p_role not in ('prof', 'eleve') then return jsonb_build_object('ok', false); end if;
  delete from access_attempts where at < now() - interval '1 day';
  if (select count(*) from access_attempts where who = p_who and at > now() - interval '10 minutes') >= 8 then
    return jsonb_build_object('ok', false, 'locked', true);
  end if;
  if v_expected is not null and v_in <> '' and v_in = _norm(p_role, v_expected) then
    return jsonb_build_object('ok', true, 'fp', _fp(p_role, v_expected));
  end if;
  insert into access_attempts (who) values (p_who);
  return jsonb_build_object('ok', false);
end $$;

-- Vérifie le code prof à chaque action d'administration : session prof valide ET code exact.
create or replace function _check_prof(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_prof() then raise exception 'Accès refusé'; end if;
  if _secret('prof') is null or _norm('prof', p_secret) is distinct from _norm('prof', _secret('prof')) then
    raise exception 'Code prof incorrect';
  end if;
end $$;

-- Saisie d'un code depuis le site : crée l'autorisation de cet appareil.
create or replace function redeem_code(p_code text, p_role text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  if auth.uid() is null then raise exception 'Session requise'; end if;
  r := _try_code(p_role, p_code, _who());
  if coalesce((r ->> 'ok')::boolean, false) then
    insert into access_grants (user_id, role, fp) values (auth.uid(), p_role, r ->> 'fp')
    on conflict (user_id) do update set
      roster_id    = case when access_grants.role = excluded.role and access_grants.fp = excluded.fp then access_grants.roster_id else null end,
      guest_nom    = case when access_grants.role = excluded.role and access_grants.fp = excluded.fp then access_grants.guest_nom else null end,
      guest_classe = case when access_grants.role = excluded.role and access_grants.fp = excluded.fp then access_grants.guest_classe else null end,
      role = excluded.role, fp = excluded.fp, last_seen = now();
    delete from access_grants where last_seen < now() - interval '120 days';
  end if;
  return r - 'fp';
end $$;

-- État de la session : null = pas (ou plus) de droit → le site renvoie à l'écran de connexion.
create or replace function my_access() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_role text := my_role(); g access_grants; r roster;
begin
  if v_role is null then return null; end if;
  update access_grants set last_seen = now() where user_id = auth.uid();
  if v_role = 'prof' then return jsonb_build_object('role', 'prof'); end if;
  select * into g from access_grants where user_id = auth.uid();
  select * into r from roster where id = g.roster_id;
  return jsonb_build_object('role', 'eleve',
    'identified', (r.id is not null or g.guest_nom is not null),
    'roster', (r.id is not null),
    'nom', coalesce(r.nom, g.guest_nom),
    'classe', coalesce(r.classe, g.guest_classe),
    'xp', coalesce(r.xp, 0));
end $$;

-- Identité de l'élève : code personnel (déjà donné par le prof) → retrouve sa progression ;
-- sinon prénom + classe (sans sauvegarde de progression).
create or replace function set_identity(p_perso text, p_nom text, p_classe text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r roster; v_who text := 'perso:' || _who(); v_code text := upper(trim(coalesce(p_perso, '')));
begin
  if my_role() is distinct from 'eleve' then raise exception 'Accès refusé'; end if;
  if v_code <> '' then
    if (select count(*) from access_attempts where who = v_who and at > now() - interval '10 minutes') >= 8 then
      raise exception 'Trop d''essais, réessaie dans quelques minutes';
    end if;
    select * into r from roster where code = v_code;
    if not found then
      insert into access_attempts (who) values (v_who);
      return jsonb_build_object('ok', false, 'error', 'Code personnel inconnu');
    end if;
    update access_grants set roster_id = r.id, guest_nom = null, guest_classe = null where user_id = auth.uid();
  else
    if length(trim(coalesce(p_nom, ''))) = 0 or p_classe not in ('seconde', 'premiere', 'terminale') then
      return jsonb_build_object('ok', false, 'error', 'Indique ton prénom et ta classe');
    end if;
    update access_grants set roster_id = null, guest_nom = left(trim(p_nom), 20), guest_classe = p_classe where user_id = auth.uid();
  end if;
  return jsonb_build_object('ok', true) || my_access();
end $$;

-- Gain d'XP : uniquement pour un élève identifié par code personnel (progression sauvegardée).
create or replace function add_xp(p_gain int) returns int
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_xp int;
begin
  if my_role() is distinct from 'eleve' then raise exception 'Accès refusé'; end if;
  select roster_id into v_id from access_grants where user_id = auth.uid();
  if v_id is null then return null; end if;
  update roster set xp = least(xp + greatest(least(coalesce(p_gain, 0), 500), 0), 1000000) where id = v_id returning xp into v_xp;
  return v_xp;
end $$;

create or replace function sign_out_access() returns void
language sql security definer set search_path = public as $$ delete from access_grants where user_id = auth.uid() $$;

-- ── Administration des codes (prof uniquement) ───────────────────
create or replace function host_get_student_code(p_secret text) returns text
language plpgsql security definer set search_path = public as $$
begin perform _check_prof(p_secret); return _secret('eleve'); end $$;

-- Change le code élève : tous les accès obtenus avec l'ancien code sont supprimés immédiatement.
create or replace function host_set_student_code(p_secret text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare v_code text := trim(coalesce(p_code, ''));
begin
  perform _check_prof(p_secret);
  if length(v_code) < 6 then raise exception 'Le code élève doit faire au moins 6 caractères'; end if;
  if lower(v_code) = lower(coalesce(_secret('prof'), '')) then raise exception 'Le code élève doit être différent du code prof'; end if;
  insert into app_config (key, value) values ('student_code', v_code)
    on conflict (key) do update set value = excluded.value;
  delete from access_grants where role = 'eleve';
end $$;

-- Change le code prof : les autres appareils prof sont déconnectés, celui-ci reste connecté.
create or replace function host_set_prof_secret(p_secret text, p_new text) returns void
language plpgsql security definer set search_path = public as $$
declare v_new text := trim(coalesce(p_new, ''));
begin
  perform _check_prof(p_secret);
  if length(v_new) < 12 then raise exception 'Le code prof doit faire au moins 12 caractères'; end if;
  if v_new = 'MON-CODE-PROF' then raise exception 'Choisis un autre code'; end if;
  if lower(v_new) = lower(coalesce(_secret('eleve'), '')) then raise exception 'Le code prof doit être différent du code élève'; end if;
  delete from access_grants where role = 'prof' and user_id <> auth.uid();
  update app_config set value = v_new where key = 'prof_secret';
  update access_grants set fp = _fp('prof', v_new) where user_id = auth.uid();
end $$;

-- ── Portail Netlify : vérification serveur à serveur (clé = gate_key) ──
create or replace function gate_login(p_key text, p_role text, p_code text, p_client text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_key is distinct from (select value from app_config where key = 'gate_key') then
    return jsonb_build_object('ok', false);
  end if;
  return _try_code(p_role, p_code, 'ip:' || left(coalesce(nullif(p_client, ''), '?'), 64));
end $$;

create or replace function gate_versions(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_key is distinct from (select value from app_config where key = 'gate_key') then return null; end if;
  return jsonb_build_object('prof', _fp('prof', _secret('prof')), 'eleve', _fp('eleve', _secret('eleve')));
end $$;

-- Les fonctions internes ne sont jamais appelables depuis le site.
revoke execute on function _secret(text), _norm(text, text), _fp(text, text), _who(),
  _try_code(text, text, text), _check_prof(text) from public, anon, authenticated;
-- Le portail (clé anonyme) appelle gate_*, protégées par la clé serveur ; le site appelle les autres.

-- ── 3. Sécurité : lecture réservée aux sessions autorisées, écriture uniquement par les fonctions ──
alter table quizzes      enable row level security;
alter table roster       enable row level security;   -- illisible : les codes restent secrets
alter table live_games   enable row level security;
alter table live_players enable row level security;
alter table live_answers enable row level security;
drop policy if exists lecture_games   on live_games;
drop policy if exists lecture_players on live_players;
drop policy if exists lecture_answers on live_answers;
create policy lecture_games   on live_games   for select to authenticated using (is_member());
create policy lecture_players on live_players for select to authenticated using (is_member());
create policy lecture_answers on live_answers for select to authenticated using (is_member());
revoke all on live_games, live_players, live_answers, quizzes from anon;
revoke insert, update, delete, truncate on live_games, live_players, live_answers from authenticated;
revoke all on quizzes from authenticated;

-- ── 4. Vues : classement d'une partie + championnat ──────────────
create or replace view live_totals as
  select p.game_id, p.id as player_id, p.nom, p.roster_id,
         coalesce(sum(a.points), 0)::int as total,
         count(*) filter (where a.correct)::int as bonnes
  from live_players p left join live_answers a on a.player_id = p.id
  where is_member()
  group by p.game_id, p.id, p.nom, p.roster_id;

create or replace view championnat as
  select t.roster_id, t.nom, r.classe, g.id as game_id, g.titre, g.created_at, t.total as pts
  from live_totals t
  join live_games g on g.id = t.game_id
  join roster r on r.id = t.roster_id
  where g.mode = 'competition' and g.status = 'finished' and is_member();

revoke all on live_totals, championnat from anon;
grant select on live_totals, championnat to authenticated;

-- ── 5. Fonctions prof (protégées par le code prof) ───────────────
create or replace function host_roster_list(p_secret text) returns setof roster
language plpgsql security definer set search_path = public as $$
begin perform _check_prof(p_secret); return query select * from roster order by classe, nom; end $$;

create or replace function host_roster_add(p_secret text, p_classe text, p_nom text) returns roster
language plpgsql security definer set search_path = public as $$
declare alpha text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; v_code text; r roster;
begin
  perform _check_prof(p_secret);
  loop
    v_code := '';
    for i in 1..4 loop v_code := v_code || substr(alpha, 1 + floor(random()*length(alpha))::int, 1); end loop;
    exit when not exists (select 1 from roster where code = v_code);
  end loop;
  insert into roster (classe, nom, code) values (p_classe, trim(p_nom), v_code) returning * into r;
  return r;
end $$;

create or replace function host_roster_delete(p_secret text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform _check_prof(p_secret); delete from roster where id = p_id; end $$;

create or replace function host_create_game(p_secret text, p_titre text, p_mode text, p_classe text, p_total int)
returns live_games language plpgsql security definer set search_path = public as $$
declare v_pin text; g live_games;
begin
  perform _check_prof(p_secret);
  update live_games set status = 'finished' where status <> 'finished' and created_at < now() - interval '12 hours';
  loop
    v_pin := lpad((floor(random()*900000)+100000)::int::text, 6, '0');
    exit when not exists (select 1 from live_games where pin = v_pin and status <> 'finished');
  end loop;
  insert into live_games (pin, titre, mode, classe, total)
    values (v_pin, p_titre, p_mode, nullif(p_classe, ''), p_total) returning * into g;
  return g;
end $$;

create or replace function host_set_question(p_secret text, p_game uuid, p_index int, p_question jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_prof(p_secret);
  update live_games set status = 'question', q_index = p_index, question = p_question,
         correct = null, reveal = null, q_started_at = now() where id = p_game;
end $$;

-- Correction : évalue chaque réponse (QCM, zone sur le plan, valeur numérique) et calcule les points
-- p_answer : {"type":"qcm","correct":1} | {"type":"zone","x":.2,"y":.3,"w":.1,"h":.1} | {"type":"num","value":2.5,"tol":0.1}
drop function if exists host_reveal(text, uuid, int, int);
create or replace function host_reveal(p_secret text, p_game uuid, p_answer jsonb, p_time int)
returns void language plpgsql security definer set search_path = public as $$
declare v_q int; v_t numeric := greatest(p_time, 1) * 1000; v_type text := coalesce(p_answer->>'type', 'qcm');
begin
  perform _check_prof(p_secret);
  select q_index into v_q from live_games where id = p_game;
  update live_answers a set correct = case
      when v_type = 'zone' then
        a.x is not null and a.y is not null
        and a.x between (p_answer->>'x')::numeric and (p_answer->>'x')::numeric + (p_answer->>'w')::numeric
        and a.y between (p_answer->>'y')::numeric and (p_answer->>'y')::numeric + (p_answer->>'h')::numeric
      when v_type = 'num' then
        a.value is not null
        and abs(a.value - (p_answer->>'value')::numeric) <= coalesce((p_answer->>'tol')::numeric, 0)
      else a.choice is not null and a.choice = (p_answer->>'correct')::int
    end
  where a.game_id = p_game and a.q_index = v_q;
  update live_answers set
    points = case when correct then round(1000 * (1 - (least(ms, v_t) / v_t) / 2))::int else 0 end
  where game_id = p_game and q_index = v_q;
  update live_games set status = 'reveal', reveal = p_answer,
         correct = case when v_type = 'qcm' then (p_answer->>'correct')::int end
   where id = p_game;
end $$;

create or replace function host_finish(p_secret text, p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform _check_prof(p_secret); update live_games set status = 'finished' where id = p_game; end $$;

-- ── 6. Fonctions élèves ──────────────────────────────────────────
create or replace function join_game(p_pin text, p_code text, p_nom text)
returns table (player_id uuid, game_id uuid, nom text, mode text)
language plpgsql security definer set search_path = public as $$
declare g live_games; r roster; p live_players; v_nom text; v_n int := 1;
begin
  if not is_member() then raise exception 'Accès refusé'; end if;
  select * into g from live_games where pin = trim(p_pin) and status <> 'finished';
  if not found then raise exception 'Code de partie introuvable'; end if;

  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select * into r from roster where code = upper(trim(p_code));
    if not found then raise exception 'Code personnel inconnu'; end if;
    if g.classe is not null and r.classe <> g.classe then raise exception 'Ce code n''est pas de la classe de cette partie'; end if;
    select * into p from live_players where live_players.game_id = g.id and roster_id = r.id;
    if not found then
      insert into live_players (game_id, roster_id, nom, owner) values (g.id, r.id, r.nom, auth.uid()) returning * into p;
    else
      update live_players set owner = auth.uid() where id = p.id;
    end if;
  else
    if g.mode = 'competition' then raise exception 'Code personnel obligatoire pour une compétition'; end if;
    v_nom := left(trim(coalesce(p_nom, '')), 20);
    if v_nom = '' then raise exception 'Choisis un pseudo'; end if;
    while exists (select 1 from live_players lp where lp.game_id = g.id and lp.nom = v_nom) loop
      v_n := v_n + 1; v_nom := left(trim(p_nom), 17) || v_n;
    end loop;
    insert into live_players (game_id, nom, owner) values (g.id, v_nom, auth.uid()) returning * into p;
  end if;
  return query select p.id, g.id, p.nom, g.mode;
end $$;

drop function if exists submit_answer(uuid, int, int, int);
create or replace function submit_answer(p_player uuid, p_q int, p_choice int, p_ms int,
                                         p_x numeric default null, p_y numeric default null, p_value numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare g live_games; v_game uuid;
begin
  if not is_member() then raise exception 'Accès refusé'; end if;
  select live_players.game_id into v_game from live_players where id = p_player and owner = auth.uid();
  select * into g from live_games where id = v_game;
  if not found or g.status <> 'question' or g.q_index <> p_q then return; end if;  -- trop tard : ignoré
  insert into live_answers (game_id, player_id, q_index, choice, ms, x, y, value)
    values (g.id, p_player, p_q, p_choice, greatest(p_ms, 0),
            least(greatest(p_x, 0), 1), least(greatest(p_y, 0), 1), p_value)
    on conflict (player_id, q_index) do nothing;
end $$;

-- ── 6 bis. Quiz sauvegardés (code prof requis) ───────────────────
create or replace function host_quiz_list(p_secret text) returns setof quizzes
language plpgsql security definer set search_path = public as $$
begin perform _check_prof(p_secret); return query select * from quizzes order by updated_at desc; end $$;

create or replace function host_quiz_save(p_secret text, p_id uuid, p_titre text, p_classe text, p_theme text, p_questions jsonb)
returns quizzes language plpgsql security definer set search_path = public as $$
declare q quizzes;
begin
  perform _check_prof(p_secret);
  if p_id is not null and exists (select 1 from quizzes where id = p_id) then
    update quizzes set titre = p_titre, classe = nullif(p_classe, ''), theme = nullif(p_theme, ''),
           questions = p_questions, updated_at = now() where id = p_id returning * into q;
  else
    insert into quizzes (titre, classe, theme, questions)
      values (p_titre, nullif(p_classe, ''), nullif(p_theme, ''), p_questions) returning * into q;
  end if;
  return q;
end $$;

create or replace function host_quiz_delete(p_secret text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform _check_prof(p_secret); delete from quizzes where id = p_id; end $$;

-- ── 6 ter. Stockage des plans, images et modèles 3D (bucket PRIVÉ « quiz-media ») ──
-- Lecture : sessions autorisées (liens signés temporaires). Envoi : prof uniquement.
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('quiz-media', 'quiz-media', false, 26214400,
              array['image/png','image/jpeg','image/webp','model/gltf-binary','application/octet-stream'])
      on conflict (id) do update set public = false, file_size_limit = 26214400,
        allowed_mime_types = array['image/png','image/jpeg','image/webp','model/gltf-binary','application/octet-stream'];
    drop policy if exists quiz_media_lecture on storage.objects;
    drop policy if exists quiz_media_envoi on storage.objects;
    create policy quiz_media_lecture on storage.objects for select to authenticated
      using (bucket_id = 'quiz-media' and is_member());
    create policy quiz_media_envoi on storage.objects for insert to authenticated
      with check (bucket_id = 'quiz-media' and is_prof());
  end if;
end $$;

-- ── 7. Temps réel ────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['live_games','live_players','live_answers'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ── 7. Tug of War (équipes, chacun à son rythme) ─────────────────
alter table live_games drop constraint if exists live_games_mode_check;
alter table live_games add constraint live_games_mode_check check (mode in ('competition','revision','tug'));
alter table live_games add column if not exists questions jsonb;            -- questions SANS réponses (mode tug)
alter table live_players add column if not exists team text check (team in ('A','B'));

create table if not exists live_secrets (game_id uuid primary key references live_games(id) on delete cascade, specs jsonb not null);
alter table live_secrets enable row level security;                         -- aucune policy : illisible côté client

create or replace function host_set_team(p_secret text, p_player uuid, p_team text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _check_prof(p_secret);
  update live_players set team = nullif(p_team, '') where id = p_player;
end $$;

create or replace function host_tug_start(p_secret text, p_game uuid, p_public jsonb, p_specs jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _check_prof(p_secret);
  insert into live_secrets (game_id, specs) values (p_game, p_specs)
    on conflict (game_id) do update set specs = excluded.specs;
  update live_games set questions = p_public, status = 'question', q_index = 0, q_started_at = now() where id = p_game;
end $$;

create or replace function submit_tug_answer(p_player uuid, p_q int, p_choice int, p_ms int,
                                             p_x numeric default null, p_y numeric default null, p_value numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g live_games; v_game uuid; v_spec jsonb; v_type text; v_ok boolean;
begin
  if not is_member() then raise exception 'Accès refusé'; end if;
  select game_id into v_game from live_players where id = p_player and owner = auth.uid();
  select * into g from live_games where id = v_game;
  if not found or g.mode <> 'tug' or g.status <> 'question' then return null; end if;
  if exists (select 1 from live_answers where player_id = p_player and q_index = p_q) then return null; end if;
  select specs -> p_q into v_spec from live_secrets where game_id = g.id;
  if v_spec is null then return null; end if;
  v_type := coalesce(v_spec->>'type', 'qcm');
  v_ok := case
    when v_type = 'zone' then p_x is not null and p_y is not null
      and p_x between (v_spec->>'x')::numeric and (v_spec->>'x')::numeric + (v_spec->>'w')::numeric
      and p_y between (v_spec->>'y')::numeric and (v_spec->>'y')::numeric + (v_spec->>'h')::numeric
    when v_type = 'num' then p_value is not null
      and abs(p_value - (v_spec->>'value')::numeric) <= coalesce((v_spec->>'tol')::numeric, 0)
    else p_choice is not null and p_choice = (v_spec->>'correct')::int
  end;
  insert into live_answers (game_id, player_id, q_index, choice, ms, correct, points, x, y, value)
    values (g.id, p_player, p_q, p_choice, greatest(p_ms, 0), v_ok, 0,
            least(greatest(p_x, 0), 1), least(greatest(p_y, 0), 1), p_value)
    on conflict (player_id, q_index) do nothing;
  return jsonb_build_object('correct', v_ok, 'spec', v_spec);
end $$;

-- join_game : pseudo autorisé aussi pour le Tug of War (déjà vrai : seule la compétition exige le code)

-- ── 8. Fin des comptes par e-mail : l'ancienne table « profiles » n'est plus accessible depuis le site ──
-- (tes données restent dans la base ; la progression vit maintenant dans la liste de classe, par code personnel)
do $$ declare pol record; begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
      execute format('drop policy %I on public.profiles', pol.policyname);
    end loop;
    execute 'revoke all on public.profiles from anon, authenticated';
  end if;
end $$;
revoke all on live_secrets from anon, authenticated;
