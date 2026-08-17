-- 犬中心リデザイン（Phase1）: dogs に散歩エリアと主役フラグを追加
-- walk_area_tags: 愛犬のよく散歩するエリア（users と同様 text[]）
-- is_primary: 将来の複数頭対応用。現状は単頭=true

alter table public.dogs add column if not exists walk_area_tags text[] not null default '{}'::text[];
alter table public.dogs add column if not exists is_primary boolean not null default true;

comment on column public.dogs.walk_area_tags is '愛犬のよく散歩するエリア（主要エリア名の配列）';
comment on column public.dogs.is_primary is '主役の愛犬フラグ（将来の複数頭対応用。現状は単頭=true）';
