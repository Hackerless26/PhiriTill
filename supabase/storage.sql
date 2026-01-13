insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and auth.uid() = owner)
with check (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and auth.uid() = owner);
