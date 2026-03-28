-- よく散歩するエリアをタグ（text[]）。アプリは string[] として送受信する。

alter table public.users add column if not exists walk_area_tags text[] not null default '{}'::text[];

do $mig$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'walk_area'
  ) then
    update public.users
    set walk_area_tags = array[btrim(walk_area)]::text[]
    where walk_area is not null
      and btrim(walk_area) <> '';
    alter table public.users drop column walk_area;
  end if;
end
$mig$;

comment on column public.users.walk_area_tags is 'よく散歩するエリア（主要エリア名の配列）';
