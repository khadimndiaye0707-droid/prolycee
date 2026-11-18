// ── Hooks : code prof (mémorisé sur l'appareil) et bibliothèque de quiz ──
import { useState, useCallback, useEffect } from "react";
import { supabase } from "./supabase";

const SECRET_KEY = "prolycee_code_prof";
const errText = (e) => (e && e.message ? e.message : "Erreur de connexion");

export function useSecret() {
  const [secret, setSecret] = useState(() => localStorage.getItem(SECRET_KEY) || "");
  const save = (v) => { setSecret(v); localStorage.setItem(SECRET_KEY, v); };
  return [secret, save];
}

const fromRow = (r) => ({ id: r.id, saved: true, title: r.titre, filiere: r.classe || "terminale", theme: r.theme || "", questions: r.questions });

export function useLibrary() {
  const [secret, setSecret] = useState(() => localStorage.getItem(SECRET_KEY) || "");
  const [items, setItems] = useState(null);        // null = pas connecté
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (sec) => {
    setLoading(true); setError("");
    const { data, error: e } = await supabase.rpc("host_quiz_list", { p_secret: sec.trim() });
    if (e) { setError(errText(e)); setItems(null); }
    else { setItems(data.map(fromRow)); localStorage.setItem(SECRET_KEY, sec.trim()); setSecret(sec.trim()); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const s = localStorage.getItem(SECRET_KEY);
    if (!s) return;
    const t = setTimeout(() => load(s), 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async (quiz) => {
    const { data, error: e } = await supabase.rpc("host_quiz_save", {
      p_secret: secret, p_id: quiz.saved ? quiz.id : null, p_titre: quiz.title, p_classe: quiz.filiere || "", p_theme: quiz.theme || "", p_questions: quiz.questions,
    });
    if (e) throw e;
    const q = fromRow(data);
    setItems((prev) => [q, ...(prev || []).filter((x) => x.id !== q.id)]);
    return q;
  };
  const remove = async (id) => {
    const { error: e } = await supabase.rpc("host_quiz_delete", { p_secret: secret, p_id: id });
    if (e) throw e;
    setItems((prev) => (prev || []).filter((x) => x.id !== id));
  };
  return { secret, items, error, loading, connect: load, save, remove, ready: items !== null };
}

