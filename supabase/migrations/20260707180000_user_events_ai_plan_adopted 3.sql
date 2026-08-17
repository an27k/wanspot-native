-- W7: ai_plan_adopted を user_events に追加
alter table public.user_events drop constraint if exists user_events_event_type_check;

alter table public.user_events add constraint user_events_event_type_check check (
  event_type in (
    'visit', 'like', 'unlike', 'review', 'spot_view', 'search',
    'ai_plan_generate', 'ai_plan_adopted', 'vlog_generate', 'share'
  )
);
