-- ワンスポまとめの配信対象を、広域キーワードではなく細かい地域/犬サイズ/テーマで扱う。
alter table public.articles
  add column if not exists target_prefectures text[] not null default '{}'::text[],
  add column if not exists target_municipalities text[] not null default '{}'::text[],
  add column if not exists target_walk_area_tags text[] not null default '{}'::text[],
  add column if not exists dog_size_tags text[] not null default '{}'::text[],
  add column if not exists topic_tags text[] not null default '{}'::text[],
  add column if not exists segment_level text not null default 'region';

alter table public.articles
  drop constraint if exists articles_segment_level_check;

alter table public.articles
  add constraint articles_segment_level_check
  check (segment_level in ('municipality', 'walk_area', 'prefecture', 'region', 'national'));

create index if not exists articles_target_prefectures_gin
  on public.articles using gin (target_prefectures);

create index if not exists articles_target_municipalities_gin
  on public.articles using gin (target_municipalities);

create index if not exists articles_target_walk_area_tags_gin
  on public.articles using gin (target_walk_area_tags);

create index if not exists articles_dog_size_tags_gin
  on public.articles using gin (dog_size_tags);

create index if not exists articles_topic_tags_gin
  on public.articles using gin (topic_tags);

create index if not exists articles_segment_level_idx
  on public.articles (segment_level);

comment on column public.articles.target_prefectures is '配信対象の都道府県。空配列は広域/全国フォールバック対象。';
comment on column public.articles.target_municipalities is '配信対象の市区町村。散歩エリアとの完全一致に使う。';
comment on column public.articles.target_walk_area_tags is 'アプリ内の散歩エリアタグと一致させるための配信対象。';
comment on column public.articles.dog_size_tags is 'XS/S/M/L/XL または 小型犬/大型犬 などの記事対象犬サイズ。';
comment on column public.articles.topic_tags is 'ドッグラン/カフェ/宿泊/雨の日/大型犬可など、記事作成・配信セグメント用テーマ。';
comment on column public.articles.segment_level is '記事の地域粒度: municipality, walk_area, prefecture, region, national。';
