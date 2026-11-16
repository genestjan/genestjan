-- Where ride photos are kept. Anyone can view a photo by its link;
-- a rider can only add or remove photos inside their own folder.
insert into storage.buckets (id, name, public) values ('ph-photos', 'ph-photos', true)
on conflict (id) do nothing;

create policy ph_photos_read on storage.objects for select using (bucket_id = 'ph-photos');
create policy ph_photos_add on storage.objects for insert to authenticated
  with check (bucket_id = 'ph-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ph_photos_drop on storage.objects for delete to authenticated
  using (bucket_id = 'ph-photos' and (storage.foldername(name))[1] = auth.uid()::text);
