import { createClient } from "@supabase/supabase-js";

// Clé « publishable » : elle est faite pour être publique (la sécurité est dans les règles RLS de Supabase).
const SUPABASE_URL = "https://winfcuvshinsxielsnln.supabase.co";
const SUPABASE_KEY = "sb_publishable_DAHanJxjvlh61GukxXfXUQ_NvVomXGf";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
