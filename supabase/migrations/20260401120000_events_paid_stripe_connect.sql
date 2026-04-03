-- イベント有料フラグ・参加費、主催者 Stripe Connect（users）
-- RLS: users は本人のみ SELECT/INSERT/UPDATE（既存ポリシーと重複する場合はダッシュボードで調整）

-- events: price が無い環境向け
alter table public.events add column if not exists price integer;

alter table public.events add column if not exists is_paid boolean not null default false;

update public.events set is_paid = (coalesce(price, 0) > 0) where true;

comment on column public.events.price is '参加費（円）。null または 0 は無料扱い';
comment on column public.events.is_paid is '有料イベントかどうか（price と整合を取る）';

alter table public.users add column if not exists stripe_account_id text;

alter table public.users add column if not exists stripe_onboarding_completed boolean not null default false;

comment on column public.users.stripe_account_id is 'Stripe Connect アカウント ID（acct_...）';
comment on column public.users.stripe_onboarding_completed is 'Connect オンボーディング完了（charges_enabled 等は別途 webhook 推奨）';

-- 広い SELECT ポリシーと併用すると stripe 列が他ユーザーに見えるため、本番ではポリシーを見直すこと
alter table public.users enable row level security;

drop policy if exists "wanspot_users_select_own" on public.users;
create policy "wanspot_users_select_own" on public.users
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "wanspot_users_insert_own" on public.users;
create policy "wanspot_users_insert_own" on public.users
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "wanspot_users_update_own" on public.users;
create policy "wanspot_users_update_own" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
