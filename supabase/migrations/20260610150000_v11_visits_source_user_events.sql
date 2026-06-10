-- v11: visits テーブル未適用 (PGRST205) 対策 + source 列 + user_events 基盤
-- 既存 20260608120000 が未デプロイの環境でも idempotent に適用可能

-- ========== visits（未作成なら作成） ==========
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

alter table public.visits
  add column if not exists source text not null default 'detail_button';

alter table public.visits drop constraint if exists visits_source_check;
alter table public.visits
  add constraint visits_source_check
  check (source in ('detail_button', 'review', 'checkin', 'other'));

create index if not exists visits_user_visited_at_idx
  on public.visits (user_id, visited_at desc);

create index if not exists visits_spot_id_idx
  on public.visits (spot_id);

create index if not exists visits_user_spot_day_idx
  on public.visits (user_id, spot_id, visited_at desc);

comment on table public.visits is '訪問ログ（レビューアルバムの1プレート）。soft_deleted で論理削除';
comment on column public.visits.source is '記録経路: detail_button / review / checkin / other';

-- ========== memories（未作成なら作成） ==========
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

create index if not exists memories_visit_id_idx on public.memories (visit_id);
create index if not exists memories_user_id_idx on public.memories (user_id);

-- ========== RLS visits ==========
alter table public.visits enable row level security;

drop policy if exists "visits_select_own" on public.visits;
create policy "visits_select_own"
  on public.visits for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "visits_insert_own" on public.visits;
create policy "visits_insert_own"
  on public.visits for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "visits_update_own" on public.visits;
create policy "visits_update_own"
  on public.visits for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "visits_delete_own" on public.visits;
create policy "visits_delete_own"
  on public.visits for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.visits to authenticated;

-- ========== RLS memories ==========
alter table public.memories enable row level security;

drop policy if exists "memories_select_own" on public.memories;
create policy "memories_select_own"
  on public.memories for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "memories_insert_own" on public.memories;
create policy "memories_insert_own"
  on public.memories for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "memories_update_own" on public.memories;
create policy "memories_update_own"
  on public.memories for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "memories_delete_own" on public.memories;
create policy "memories_delete_own"
  on public.memories for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.memories to authenticated;

-- ========== user_events（分析用・本人 insert のみ） ==========
create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  spot_id uuid null references public.spots (id) on delete set null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_events_event_type_check check (
    event_type in (
      'visit', 'like', 'unlike', 'review', 'spot_view', 'search',
      'ai_plan_generate', 'vlog_generate', 'share'
    )
  )
);

create index if not exists user_events_user_created_idx
  on public.user_events (user_id, created_at desc);

create index if not exists user_events_type_created_idx
  on public.user_events (event_type, created_at desc);

comment on table public.user_events is
  '行動イベントログ（分析用）。正データは visits/spot_likes 等。集計は service-role のみ。'
-- TODO(プライバシー): 広告・マーケ用途前にプライバシーポリシーと App Store ラベル更新。外部提供なし。

alter table public.user_events enable row level security;

drop policy if exists "user_events_insert_own" on public.user_events;
create policy "user_events_insert_own"
  on public.user_events for insert to authenticated
  with check (auth.uid() = user_id);

-- read/集計は service-role のみ（authenticated 向け select ポリシーは付けない）
grant insert on public.user_events to authenticated;

-- ========== 派生集計（service-role バッチ / 週次 cron 用の設計メモ） ==========
-- home_area_estimate: visit/spot_view の spot_id → spots.prefecture/municipality 最頻
-- genre_affinity: イベント対象 spot の extended_category / google_types 分布
-- active_radius: visit 時の user lat/lng（props）から半径推定
-- 実装: materialized view または集計テーブル + pg_cron（service-role）

notify pgrst, 'reload schema';
