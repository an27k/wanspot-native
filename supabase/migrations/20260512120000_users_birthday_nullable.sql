-- Apple 審査: オーナー生年月日を任意入力に。未入力は NULL。
alter table public.users
  alter column birthday drop not null;

comment on column public.users.birthday is 'オーナー生年月日（任意。YYYY-MM-DD または NULL）';
