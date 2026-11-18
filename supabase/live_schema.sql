-- ════════════════════════════════════════════════════════════════
--  ProLycée — Quiz live (étape 1)
--  À coller UNE SEULE FOIS dans Supabase > SQL Editor > New query > Run
--  Avant de lancer : remplace MON-CODE-PROF (ligne « app_config ») par
--  ton propre code secret (tu le taperas dans le site pour piloter les parties).
-- ════════════════════════════════════════════════════════════════

-- ── 1. Code secret du prof ───────────────────────────────────────
create table if not exists app_config (key text primary key, value text not null);
alter table app_config enable row level security;   -- aucune policy = illisible depuis le site
insert into app_config (key, value) values ('prof_secret', 'MON-CODE-PROF')
  on conflict (key) do nothing;

create or replace function _check_prof(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from app_config where key = 'prof_secret') then
    raise exception 'Code prof incorrect';
  end if;
end $$;

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

-- ── 3. Sécurité : lecture publique du jeu, écriture uniquement par les fonctions ──
alter table roster       enable row level security;   -- illisible : les codes restent secrets
alter table live_games   enable row level security;
alter table live_players enable row level security;
alter table live_answers enable row level security;
drop policy if exists lecture_games   on live_games;
drop policy if exists lecture_players on live_players;
drop policy if exists lecture_answers on live_answers;
create policy lecture_games   on live_games   for select using (true);
create policy lecture_players on live_players for select using (true);
create policy lecture_answers on live_answers for select using (true);

-- ── 4. Vues : classement d'une partie + championnat ──────────────
create or replace view live_totals as
  select p.game_id, p.id as player_id, p.nom, p.roster_id,
         coalesce(sum(a.points), 0)::int as total,
         count(*) filter (where a.correct)::int as bonnes
  from live_players p left join live_answers a on a.player_id = p.id
  group by p.game_id, p.id, p.nom, p.roster_id;

create or replace view championnat as
  select t.roster_id, t.nom, r.classe, g.id as game_id, g.titre, g.created_at, t.total as pts
  from live_totals t
  join live_games g on g.id = t.game_id
  join roster r on r.id = t.roster_id
  where g.mode = 'competition' and g.status = 'finished';

grant select on live_totals, championnat to anon, authenticated;

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
         correct = null, q_started_at = now() where id = p_game;
end $$;

-- Correction : fixe la bonne réponse et calcule les points (1000 max, 500 min, selon la rapidité)
create or replace function host_reveal(p_secret text, p_game uuid, p_correct int, p_time int)
returns void language plpgsql security definer set search_path = public as $$
declare v_q int; v_t numeric := greatest(p_time, 1) * 1000;
begin
  perform _check_prof(p_secret);
  select q_index into v_q from live_games where id = p_game;
  update live_answers set
    correct = (choice = p_correct),
    points = case when choice = p_correct
                  then round(1000 * (1 - (least(ms, v_t) / v_t) / 2))::int else 0 end
  where game_id = p_game and q_index = v_q;
  update live_games set status = 'reveal', correct = p_correct where id = p_game;
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
  select * into g from live_games where pin = trim(p_pin) and status <> 'finished';
  if not found then raise exception 'Code de partie introuvable'; end if;

  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select * into r from roster where code = upper(trim(p_code));
    if not found then raise exception 'Code personnel inconnu'; end if;
    if g.classe is not null and r.classe <> g.classe then raise exception 'Ce code n''est pas de la classe de cette partie'; end if;
    select * into p from live_players where live_players.game_id = g.id and roster_id = r.id;
    if not found then
      insert into live_players (game_id, roster_id, nom) values (g.id, r.id, r.nom) returning * into p;
    end if;
  else
    if g.mode = 'competition' then raise exception 'Code personnel obligatoire pour une compétition'; end if;
    v_nom := left(trim(coalesce(p_nom, '')), 20);
    if v_nom = '' then raise exception 'Choisis un pseudo'; end if;
    while exists (select 1 from live_players lp where lp.game_id = g.id and lp.nom = v_nom) loop
      v_n := v_n + 1; v_nom := left(trim(p_nom), 17) || v_n;
    end loop;
    insert into live_players (game_id, nom) values (g.id, v_nom) returning * into p;
  end if;
  return query select p.id, g.id, p.nom, g.mode;
end $$;

create or replace function submit_answer(p_player uuid, p_q int, p_choice int, p_ms int)
returns void language plpgsql security definer set search_path = public as $$
declare g live_games; v_game uuid;
begin
  select live_players.game_id into v_game from live_players where id = p_player;
  select * into g from live_games where id = v_game;
  if not found or g.status <> 'question' or g.q_index <> p_q then return; end if;  -- trop tard : ignoré
  insert into live_answers (game_id, player_id, q_index, choice, ms)
    values (g.id, p_player, p_q, p_choice, greatest(p_ms, 0))
    on conflict (player_id, q_index) do nothing;
end $$;

-- ── 7. Temps réel ────────────────────────────────────────────────
alter publication supabase_realtime add table live_games;
alter publication supabase_realtime add table live_players;
alter publication supabase_realtime add table live_answers;
