-- 未ログイン閲覧の行動も蓄積する。user_id はログイン後に紐づく。
-- Apple 5.1.1(v) で地図・イベント一覧は登録なしで開けるため、ゲスト行を許可する。

alter table public.user_events drop constraint if exists user_events_event_type_check;
alter table public.user_events add constraint user_events_event_type_check check (
  event_type in (
    'visit', 'like', 'unlike', 'review', 'spot_view', 'search',
    'ai_plan_generate', 'ai_plan_adopted', 'vlog_generate', 'share',
    'app_open', 'map_view', 'area_search', 'event_view', 'login_prompt'
  )
);

alter table public.user_events alter column user_id drop not null;
alter table public.user_events add column if not exists anonymous_id text;

create index if not exists user_events_anonymous_created_idx
  on public.user_events (anonymous_id, created_at desc);

drop policy if exists "user_events_insert_guest" on public.user_events;
create policy "user_events_insert_guest"
  on public.user_events for insert to anon
  with check (
    user_id is null
    and anonymous_id is not null
    and char_length(anonymous_id) >= 16
  );

grant insert on public.user_events to anon;
