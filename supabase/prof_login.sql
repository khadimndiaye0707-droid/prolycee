-- ════════════════════════════════════════════════════════════════
--  ProLycée — Connexion professeur sécurisée
--  À coller dans Supabase > SQL Editor > New query > Run.
--  Peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════

-- 1. Fonction qui vérifie le code prof côté serveur (le code n'est jamais lisible depuis le site)
create or replace function check_prof(p_secret text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform _check_prof(p_secret);   -- lève « Code prof incorrect » si faux
  return true;
end $$;

grant execute on function check_prof(text) to anon, authenticated;

-- 2. IMPORTANT : choisis ton vrai code prof (long : 12 caractères ou plus).
--    Remplace MON-NOUVEAU-CODE puis garde les guillemets simples.
--    (Si tu n'as jamais changé le code, il vaut encore « MON-CODE-PROF » : à remplacer absolument.)
-- update app_config set value = 'MON-NOUVEAU-CODE' where key = 'prof_secret';
