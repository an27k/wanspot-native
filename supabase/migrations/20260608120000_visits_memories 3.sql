-- 訪問ログ (visits) と思い出メディア (memories) — 既存 check_ins / dog_photos 等は変更しない
-- 事前確認: check_ins.spot_id / spot_likes.spot_id は spots.id への uuid 参照（アプリコードより）

-- ========== visits ==========
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  visited_at timestamptz not null default now(),
  comment text null,
  rating int null check (rating between 1 and 5),
  soft_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists visits_user_visited_at_idx
  on public.visits (user_id, visited_at desc);

create index if not exists visits_spot_id_idx
  on public.visits (spot_id);

comment on table public.visits is '訪問ログ（レビューアルバムの1プレート）。soft_deleted で論理削除';

-- ========== memories ==========
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  thumbnail_url text null,
  soft_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists memories_visit_id_idx
  on public.memories (visit_id);

create index if not exists memories_user_id_idx
  on public.memories (user_id);

comment on column public.memories.media_url is 'Storage パス（memories バケット内 {userId}/...）。表示時は署名 URL';

-- ========== RLS visits ==========
alter table public.visits enable row level security;

drop policy if exists "visits_select_own" on public.visits;
create policy "visits_select_own"
  on public.visits for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "visits_insert_own" on public.visits;
create policy "visits_insert_own"
  on public.visits for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "visits_update_own" on public.visits;
create policy "visits_update_own"
  on public.visits for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "visits_delete_own" on public.visits;
create policy "visits_delete_own"
  on public.visits for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.visits to authenticated;

-- ========== RLS memories ==========
alter table public.memories enable row level security;

drop policy if exists "memories_select_own" on public.memories;
create policy "memories_select_own"
  on public.memories for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "memories_insert_own" on public.memories;
create policy "memories_insert_own"
  on public.memories for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "memories_update_own" on public.memories;
create policy "memories_update_own"
  on public.memories for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "memories_delete_own" on public.memories;
create policy "memories_delete_own"
  on public.memories for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.memories to authenticated;

-- ========== Storage: memories (private) ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories',
  'memories',
  false,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "memories_storage_select_own" on storage.objects;
create policy "memories_storage_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "memories_storage_insert_own" on storage.objects;
create policy "memories_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "memories_storage_update_own" on storage.objects;
create policy "memories_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "memories_storage_delete_own" on storage.objects;
create policy "memories_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
