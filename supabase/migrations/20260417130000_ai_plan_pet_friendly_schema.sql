-- AIプラン・ペット可否検証・Routesキャッシュ・外部イベント整理
-- 適用: Supabase で1回のみ実行（複数リポジトリに同内容がある場合はどちらか一方から）

-- ========== 1. dogs.size ==========
alter table public.dogs
  add column if not exists size text;

comment on column public.dogs.size is 'XS|S|M|L|XL アプリ側バリデーション。既存ユーザーは NULL可';

-- ========== 2. spots ペット可否（6カラム） ==========
alter table public.spots
  add column if not exists pet_friendly_verified boolean not null default false,
  add column if not exists pet_friendly_status text,
  add column if not exists pet_friendly_source text,
  add column if not exists pet_friendly_source_url text,
  add column if not exists pet_friendly_checked_at timestamptz,
  add column if not exists pet_friendly_notes text;

alter table public.spots
  drop constraint if exists spots_pet_friendly_status_check;

alter table public.spots
  add constraint spots_pet_friendly_status_check
  check (
    pet_friendly_status is null
    or pet_friendly_status in (
      'allowed', 'leashed_only', 'outdoor_only', 'not_allowed', 'unknown'
    )
  );

comment on column public.spots.pet_friendly_verified is 'ペット可否バッチで検証済みなら true';

create index if not exists spots_pet_friendly_unverified_idx
  on public.spots (id)
  where pet_friendly_verified = false;

-- ========== 3. spot_route_cache（Routes API 結果） ==========
create table if not exists public.spot_route_cache (
  id uuid primary key default gen_random_uuid(),
  origin_place_id text not null,
  destination_place_id text not null,
  travel_mode text not null,
  duration_seconds integer not null,
  distance_meters integer not null,
  fetched_at timestamptz not null default now(),
  constraint spot_route_cache_mode_check
    check (travel_mode in ('walking', 'driving', 'transit')),
  constraint spot_route_cache_unique_triple unique (origin_place_id, destination_place_id, travel_mode)
);

create index if not exists spot_route_cache_lookup_idx
  on public.spot_route_cache (origin_place_id, destination_place_id, travel_mode);

comment on table public.spot_route_cache is 'Google Routes API computeRoutes の結果キャッシュ。transit は将来フォーム復活用に型のみ保持';

alter table public.spot_route_cache enable row level security;

revoke all on public.spot_route_cache from public;
revoke all on public.spot_route_cache from anon, authenticated;

-- クライアントからは直接アクセスさせない（API は service_role で読み書き）

-- ========== 4. ai_plans（履歴・FIFO） ==========
create table if not exists public.ai_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  input_params jsonb not null,
  generated_plan jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_plans_user_created_idx
  on public.ai_plans (user_id, created_at desc);

create or replace function public.enforce_ai_plans_fifo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ai_plans p
  where p.user_id = new.user_id
    and p.id not in (
      select id
      from public.ai_plans
      where user_id = new.user_id
      order by created_at desc
      limit 5
    );
  return new;
end;
$$;

drop trigger if exists trg_ai_plans_fifo on public.ai_plans;
create trigger trg_ai_plans_fifo
  after insert on public.ai_plans
  for each row
  execute function public.enforce_ai_plans_fifo();

alter table public.ai_plans enable row level security;

drop policy if exists "ai_plans_select_own" on public.ai_plans;
create policy "ai_plans_select_own"
  on public.ai_plans for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "ai_plans_insert_own" on public.ai_plans;
create policy "ai_plans_insert_own"
  on public.ai_plans for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.ai_plans to authenticated;

-- ========== 5. 外部イベント関連の整理 ==========
drop table if exists public.external_events cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ai_cache'
  ) then
    delete from public.ai_cache
    where key like 'external_events%';
  end if;
end $$;

-- ========== 6. dogs.size について ==========
-- dogsテーブルの RLS は既存プロジェクト設定に依存する。
-- 通常は user_id = auth.uid() の行のみ更新可で size も同一ポリシーの対象。
-- 本マイグレーションでは dogs のポリシーを新規作成しない（既存ポリシーと衝突しうるため）。
