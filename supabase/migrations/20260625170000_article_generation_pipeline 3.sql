-- AI記事生成を「素材収集 -> 生成 -> 品質ゲート -> draft/公開判定」で管理する。

alter table public.articles
  add column if not exists generation_source text,
  add column if not exists quality_score integer,
  add column if not exists quality_report jsonb not null default '{}'::jsonb;

alter table public.articles
  drop constraint if exists articles_quality_score_check;

alter table public.articles
  add constraint articles_quality_score_check
  check (quality_score is null or (quality_score >= 0 and quality_score <= 100));

create table if not exists public.article_generation_segments (
  id uuid primary key default gen_random_uuid(),
  segment_key text not null unique,
  prefecture text,
  municipality text,
  walk_area_tag text,
  dog_size_tag text,
  topic_tag text not null,
  priority_score integer not null default 50,
  article_count integer not null default 0,
  target_article_count integer not null default 3,
  status text not null default 'missing',
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_generation_segments_status_check
    check (status in ('missing', 'queued', 'drafting', 'covered', 'paused'))
);

create index if not exists article_generation_segments_status_priority_idx
  on public.article_generation_segments (status, priority_score desc, updated_at asc);

create index if not exists article_generation_segments_area_idx
  on public.article_generation_segments (prefecture, municipality, walk_area_tag);

create table if not exists public.article_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid references public.article_generation_segments(id) on delete set null,
  status text not null default 'queued',
  priority_score integer not null default 50,
  target_prefectures text[] not null default '{}'::text[],
  target_municipalities text[] not null default '{}'::text[],
  target_walk_area_tags text[] not null default '{}'::text[],
  dog_size_tags text[] not null default '{}'::text[],
  topic_tags text[] not null default '{}'::text[],
  segment_level text not null default 'walk_area',
  material_pack jsonb not null default '{}'::jsonb,
  outline jsonb not null default '{}'::jsonb,
  draft_article jsonb not null default '{}'::jsonb,
  quality_score integer,
  quality_report jsonb not null default '{}'::jsonb,
  article_id uuid references public.articles(id) on delete set null,
  model text,
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_generation_jobs_status_check
    check (status in ('queued', 'collecting_materials', 'drafting', 'quality_check', 'needs_review', 'ready_to_publish', 'published', 'failed')),
  constraint article_generation_jobs_quality_score_check
    check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  constraint article_generation_jobs_segment_level_check
    check (segment_level in ('municipality', 'walk_area', 'prefecture', 'region', 'national'))
);

create index if not exists article_generation_jobs_status_priority_idx
  on public.article_generation_jobs (status, priority_score desc, updated_at asc);

create index if not exists article_generation_jobs_segment_idx
  on public.article_generation_jobs (segment_id);

create index if not exists article_generation_jobs_article_idx
  on public.article_generation_jobs (article_id);

create table if not exists public.article_generation_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.article_generation_jobs(id) on delete cascade,
  spot_id uuid references public.spots(id) on delete set null,
  place_id text,
  source_type text not null,
  source_url text,
  title text,
  extracted_facts jsonb not null default '{}'::jsonb,
  confidence_score integer,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint article_generation_sources_source_type_check
    check (source_type in ('places', 'official_site', 'user_review', 'manual_note', 'llm_inference')),
  constraint article_generation_sources_confidence_check
    check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100))
);

create index if not exists article_generation_sources_job_idx
  on public.article_generation_sources (job_id);

create index if not exists article_generation_sources_spot_idx
  on public.article_generation_sources (spot_id);

comment on column public.articles.generation_source is 'manual / ai_draft / ai_auto など、記事作成元。';
comment on column public.articles.quality_score is '記事品質ゲートの最終スコア。80以上を自動公開候補、未満は人間レビュー推奨。';
comment on column public.articles.quality_report is '品質ゲートの詳細レポート。';
comment on table public.article_generation_segments is '不足している地域×犬サイズ×テーマの生成対象セグメント。';
comment on table public.article_generation_jobs is 'AI記事生成ジョブ。素材パック、アウトライン、ドラフト、品質結果を保持する。';
comment on table public.article_generation_sources is '記事生成で参照したスポット・公式サイト・レビューなどの根拠ソース。';
