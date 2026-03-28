-- アプリはオーナー生年月日を YYYY-MM-DD 文字列で users.birthday に保存します。
-- エラー: Could not find the 'birthday' column of 'users' in the schema cache
-- → 未適用の場合は Supabase Dashboard → SQL → 本ファイルを実行してください。

alter table public.users
  add column if not exists birthday date;

comment on column public.users.birthday is 'オーナー生年月日（アプリは date として YYYY-MM-DD を送る）';
