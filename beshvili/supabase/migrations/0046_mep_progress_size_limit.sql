-- הקשחת mep_progress: הגבלת גודל עמודת ה-jsonb.
-- ה-anon key ציבורי, ולכן משתמש מאומת יכול לכתוב לשורה שלו גם ישירות דרך
-- ה-REST API — בלי מגבלה אפשר לנפח את מסד הנתונים בכוונה. המבנה הלגיטימי
-- (completed / tofes4 / bestExam) שוקל פחות מ-4KB, אז 64KB הוא שוליים נדיבים.
alter table public.mep_progress
  add constraint mep_progress_data_size_check
  check (pg_column_size(data) < 65536);
