-- ============================================================================
-- ゲストの行動ログ insert に上限を付ける。
--
-- 【なぜ必要か】
-- 20260816040000_user_events_guest_tracking.sql で anon に insert を開放した。
-- 読み取りは開けていないので設計は妥当だが、**件数の上限が無かった**。
-- anonymous_id はクライアント生成なので偽造できる。
--
-- そしてアプリは lib/user-events.ts で
--   supabase.from('user_events').insert(row)
-- とクライアントの anon キーから直接DBへ書く。Next.js を経由しないので、
-- Web側のレート制限（api_rate_limits / middleware）は一切効かない。
-- **止められる場所はDBの中だけ。**
--
-- 【設計】
-- 毎回 COUNT すると行数に比例して重くなるので、カウンタ表で O(1) にする
-- （Web側の public.bump_rate_limit と同じ考え方）。
--
--   anon:<anonymous_id>  1日 1,000件まで … 暴走したクライアントと素朴な連投を止める
--   global               1日 500,000件まで … 暴走そのものの受け皿
--
-- 【この対策の限界を明記しておく】
-- anonymous_id を回し続ける相手は per-id の上限では止まらない。global の上限は
-- 「異常に気づく前に表が太り切る」のを防ぐための backstop であって、
-- 意図的な攻撃を防ぐものではない。本気で止めるなら、書き込みを
-- 認証つきのサーバ経路に寄せてIP単位で絞るしかない。
-- 匿名計測は「取れなくなるより取れるほうがまし」なので、まずここまでにする。
--
-- 【弾かれたときの挙動】
-- アプリは insert のエラーを console.warn して続行する（lib/user-events.ts:75）。
-- クラッシュはせず、その1件が落ちるだけ。
-- ============================================================================

create table if not exists public.guest_event_quota (
  bucket text not null,
  day date not null,
  count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket, day)
);

comment on table public.guest_event_quota is
  'ゲスト行動ログの日次カウンタ。user_events への insert 時にトリガが更新する。service_role のみ';

alter table public.guest_event_quota enable row level security;
alter table public.guest_event_quota force row level security;
revoke all on table public.guest_event_quota from public, anon, authenticated;
grant all on table public.guest_event_quota to service_role;

-- 古い日付の行を残しても意味が無い。1日1回だけ掃除する
create index if not exists guest_event_quota_day_idx
  on public.guest_event_quota (day);

/*
  上限の値。変えるときはここだけ触る。
  security definer なので、anon が RLS で読めない表を数えられる。
*/
create or replace function public.enforce_guest_user_event_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_anon_limit constant bigint := 1000;
  global_limit   constant bigint := 500000;
  today          constant date := (now() at time zone 'Asia/Tokyo')::date;
  anon_count     bigint;
  global_count   bigint;
  is_new_day     boolean;
begin
  -- ログイン済みの行は対象外。認証で既に縛られている
  if new.user_id is not null then
    return new;
  end if;

  insert into public.guest_event_quota (bucket, day, count, updated_at)
  values ('global', today, 1, now())
  on conflict (bucket, day)
  do update set count = public.guest_event_quota.count + 1, updated_at = now()
  returning count into global_count;

  -- その日の最初の1件でだけ古い行を掃除する
  is_new_day := global_count = 1;
  if is_new_day then
    delete from public.guest_event_quota where day < today - 7;
  end if;

  if global_count > global_limit then
    raise exception
      'guest user_events global daily quota exceeded (% > %)', global_count, global_limit
      using errcode = 'check_violation';
  end if;

  /*
    anon の insert ポリシーは anonymous_id を必須にしているが、service_role は
    それを通らずに書ける。null を連結すると bucket が null になって
    主キー違反で落ちるので、per-id の集計だけ飛ばす（global は数えてある）。
  */
  if new.anonymous_id is null then
    return new;
  end if;

  insert into public.guest_event_quota (bucket, day, count, updated_at)
  values ('anon:' || new.anonymous_id, today, 1, now())
  on conflict (bucket, day)
  do update set count = public.guest_event_quota.count + 1, updated_at = now()
  returning count into anon_count;

  if anon_count > per_anon_limit then
    raise exception
      'guest user_events per-anonymous_id daily quota exceeded (% > %)', anon_count, per_anon_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_guest_user_event_quota() from public, anon, authenticated;

drop trigger if exists enforce_guest_user_event_quota_trg on public.user_events;
create trigger enforce_guest_user_event_quota_trg
  before insert on public.user_events
  for each row
  execute function public.enforce_guest_user_event_quota();
