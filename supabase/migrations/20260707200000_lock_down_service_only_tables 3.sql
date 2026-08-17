-- サービス専用テーブルの RLS 有効化と anon/authenticated の権限剥奪。
-- spot_collect_automation / article_generation_pipeline で作成したテーブルが
-- デフォルト権限のままクライアント（anon キー）から読み書きできていたため、
-- spot_route_cache と同じパターンで塞ぐ。

-- ========== スポット自動収集の制御テーブル ==========
alter table public.collect_config enable row level security;
alter table public.collect_usage enable row level security;
alter table public.area_coverage enable row level security;

revoke all on public.collect_config from public;
revoke all on public.collect_config from anon, authenticated;
revoke all on public.collect_usage from public;
revoke all on public.collect_usage from anon, authenticated;
revoke all on public.area_coverage from public;
revoke all on public.area_coverage from anon, authenticated;

-- ========== AI 記事生成パイプライン ==========
alter table public.article_generation_segments enable row level security;
alter table public.article_generation_jobs enable row level security;
alter table public.article_generation_sources enable row level security;

revoke all on public.article_generation_segments from public;
revoke all on public.article_generation_segments from anon, authenticated;
revoke all on public.article_generation_jobs from public;
revoke all on public.article_generation_jobs from anon, authenticated;
revoke all on public.article_generation_sources from public;
revoke all on public.article_generation_sources from anon, authenticated;

-- クライアントからは直接アクセスさせない（cron / 管理 API は service_role で読み書き）
