-- 記事一覧のパーソナライズ並べ替えは articles.blocks / spot_links から抽出したスポット参照だけを使う。
-- 一覧取得のたびに重い blocks(jsonb) 全体を転送しているのがペイロード肥大の主因のため、
-- 軽量な text[] カラムに事前計算しておき、一覧クエリでは blocks/spot_links を選択しなくて済むようにする。
-- blocks/spot_links への insert/update 時にトリガーで自動再計算されるため、
-- 記事生成パイプライン側の実装（別リポジトリ）を変更しなくても常に整合する。

create or replace function public.compute_article_linked_spot_refs(p_blocks jsonb, p_spot_links jsonb)
returns text[]
language sql
immutable
as $$
  with blocks_arr as (
    select case when jsonb_typeof(p_blocks) = 'array' then p_blocks else '[]'::jsonb end as b
  ), links_arr as (
    select case when jsonb_typeof(p_spot_links) = 'array' then p_spot_links else '[]'::jsonb end as l
  ), refs as (
    select trim(coalesce(elem->>'spot_id', elem->>'spotId', '')) as ref
    from blocks_arr, jsonb_array_elements(blocks_arr.b) as elem
    where lower(trim(coalesce(elem->>'type', ''))) = 'spot'
    union all
    select trim(coalesce(elem->>'spot_id', elem->>'spotId', '')) as ref
    from links_arr, jsonb_array_elements(links_arr.l) as elem
  )
  select coalesce(array_agg(distinct ref order by ref), '{}'::text[])
  from refs
  where ref <> '';
$$;

comment on function public.compute_article_linked_spot_refs(jsonb, jsonb) is
  'articles.blocks（type=spot ブロック）と spot_links から spot_id/place_id 参照を重複排除して抽出する（クライアント側 extractSpotIdsFromArticle と同等のロジック）。';

alter table public.articles
  add column if not exists linked_spot_refs text[] not null default '{}'::text[];

comment on column public.articles.linked_spot_refs is
  '記事本文中で参照されているスポットの id / place_id（blocks + spot_links から自動抽出）。一覧のパーソナライズ並べ替えで blocks 全体を転送せずに済むための軽量カラム。';

create index if not exists articles_linked_spot_refs_idx
  on public.articles using gin (linked_spot_refs);

create or replace function public.articles_sync_linked_spot_refs()
returns trigger
language plpgsql
as $$
begin
  new.linked_spot_refs := public.compute_article_linked_spot_refs(new.blocks, new.spot_links);
  return new;
end;
$$;

drop trigger if exists articles_sync_linked_spot_refs_trg on public.articles;
create trigger articles_sync_linked_spot_refs_trg
  before insert or update of blocks, spot_links on public.articles
  for each row
  execute function public.articles_sync_linked_spot_refs();

-- 既存行のバックフィル
update public.articles
set linked_spot_refs = public.compute_article_linked_spot_refs(blocks, spot_links)
where linked_spot_refs = '{}'::text[] and (blocks is not null or spot_links is not null);
