-- spots: Google Places types snapshot + extended category (AI plan, etc.)
alter table public.spots
  add column if not exists google_types jsonb;

alter table public.spots
  add column if not exists extended_category text;

comment on column public.spots.google_types is 'Google Places API types[] snapshot (jsonb)';
comment on column public.spots.extended_category is 'App-specific category (e.g. dog_run, onsen). NULL if unused';
