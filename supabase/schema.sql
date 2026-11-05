-- Our Little Universe: private shared photobook
-- Run this once in Supabase Dashboard → SQL Editor → New query.

create table if not exists public.photobook_pages (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  caption text not null default '',
  position integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.photobook_pages enable row level security;

-- Both invited accounts can view and edit the shared book.
create policy "signed-in partners can view pages"
  on public.photobook_pages for select to authenticated using (true);
create policy "signed-in partners can add pages"
  on public.photobook_pages for insert to authenticated with check (true);
create policy "signed-in partners can edit pages"
  on public.photobook_pages for update to authenticated using (true) with check (true);
create policy "signed-in partners can remove pages"
  on public.photobook_pages for delete to authenticated using (true);

-- Private bucket: images are only retrievable by signed-in partners.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photobook', 'photobook', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'];

create policy "signed-in partners can view photobook images"
  on storage.objects for select to authenticated using (bucket_id = 'photobook');
create policy "signed-in partners can upload photobook images"
  on storage.objects for insert to authenticated with check (bucket_id = 'photobook');
create policy "signed-in partners can update photobook images"
  on storage.objects for update to authenticated using (bucket_id = 'photobook') with check (bucket_id = 'photobook');
create policy "signed-in partners can delete photobook images"
  on storage.objects for delete to authenticated using (bucket_id = 'photobook');

-- Enable live updates so edits on one phone appear on the other.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'photobook_pages'
  ) then
    alter publication supabase_realtime add table public.photobook_pages;
  end if;
end $$;
