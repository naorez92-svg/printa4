-- השלמת מדיניות RLS ל-mep_progress: זכות מחיקה למשתמש על השורה של עצמו.
-- בלי המדיניות הזו מחיקה נדחית לכולם (default-deny), כלומר למשתמש אין דרך
-- למחוק את נתוני הלמידה המסונכרנים שלו (עקרון מחיקת-מידע / GDPR).
drop policy if exists "mep_progress_delete_own" on public.mep_progress;
create policy "mep_progress_delete_own" on public.mep_progress
  for delete using (auth.uid() = user_id);
