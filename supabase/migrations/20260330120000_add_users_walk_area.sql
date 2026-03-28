-- よく散歩するエリア（自由記述）。オンボーディング・マイページで編集。

alter table public.users
  add column if not exists walk_area text;

comment on column public.users.walk_area is 'よく散歩するエリア（区市町村・公園周辺など）';
