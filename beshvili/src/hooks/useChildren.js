import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useChildren() {
  const [children, setChildren] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("children")
      .select("id, name, grade, worlds, level")
      .order("name");
    setChildren(data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async ({ name, grade, world, level }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !name?.trim()) return null;

    const exists = children.find(c => c.name === name.trim());
    if (exists) return exists;

    const { data, error } = await supabase
      .from("children")
      .insert({
        user_id: user.id,
        name: name.trim(),
        grade: grade?.trim() || null,
        worlds: world ? [world] : [],
        level: level || "medium",
      })
      .select("id, name, grade, worlds, level")
      .single();

    if (error || !data) return null;
    setChildren(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, "he")));
    return data;
  }, [children]);

  return { children, loaded, refresh, save };
}
