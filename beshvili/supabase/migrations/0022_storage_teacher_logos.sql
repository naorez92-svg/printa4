-- Storage policies for teacher-logos bucket (bucket created manually in dashboard)
-- Mirrors the pattern from 0011_storage_child_photos.sql

create policy "authenticated upload to own logo folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'teacher-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "authenticated update own logo"
  on storage.objects for update to authenticated
  using (bucket_id = 'teacher-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public read teacher logos"
  on storage.objects for select to public
  using (bucket_id = 'teacher-logos');

create policy "authenticated delete own logo"
  on storage.objects for delete to authenticated
  using (bucket_id = 'teacher-logos' and (storage.foldername(name))[1] = auth.uid()::text);
