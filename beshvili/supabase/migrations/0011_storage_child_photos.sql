-- Storage bucket for child profile photos (public — URLs embedded in shared booklet HTML)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'child-photos',
  'child-photos',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

create policy "authenticated upload to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public read child photos"
  on storage.objects for select to public
  using (bucket_id = 'child-photos');

create policy "authenticated delete own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text);
