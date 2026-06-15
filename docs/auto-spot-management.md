# 全国スポット完全自動管理 — 設計ドキュメント

> 対象リポジトリ: **`wanspot`（Next.js + Supabase バックエンド）** ／ 起点整理: Fable5 セッションのサービスロジック
> 本書は `wanspot-native` 内に置いているが、実装はすべて `wanspot` 側。整ったら `wanspot/docs/` へ移動してよい。

## 0. ゴール / 非ゴール

**ゴール**
- 日本全国のペット可スポットを、人手を介さず継続的に DB（`spots`）へ追加し続ける。
- 一通り行き渡った後は、定期的に「登録数チェック＋差分同期」を回し、**新規追加**と**閉店/消失の削除（ソフト）**を自動反映する。

**非ゴール（明示的に対象外）**
- Google に存在する全店舗の「完全列挙」（仕様上不可能。後述）。
- イベント情報の自動取り込み（`external_events` パイプラインは既に廃止済み）。
- リアルタイム同期（バッチ＝日次/週次で十分）。

---

## 1. 実現可能性と前提制約

| 制約 | 内容 | 設計への影響 |
|---|---|---|
| 検索結果上限 | Nearby/Text Search は 1クエリ最大 60件（20×3ページ、`next_page_token`） | 「網羅」ではなく **市区町村 × カテゴリ × グリッドtiling** で近似カバレッジ |
| Google ToS（キャッシュ） | `place_id` は永続保存可。その他フィールドは **30日以内にリフレッシュ**必須 | reconciliation cron で `last_synced_at` 古い順に Details 再取得 |
| 閉店検知 | Place Details `business_status`（`OPERATIONAL` / `CLOSED_TEMPORARILY` / `CLOSED_PERMANENTLY`） | `spots.business_status` 列を**新規追加**し、`CLOSED_PERMANENTLY` をソフト削除 |
| コスト | Nearby/Text/Details いずれも課金。全国tilingは件数が膨大 | cron ごとに **件数・予算上限（クォータ）** を持たせ、複数回に分割前進 |
| 「完了」の定義 | 「全国全部登録された」は厳密に定義不能 | `area_coverage` の全エリアが `done` を**実務上の完了**と定義 |

---

## 2. 既存の再利用部品（新規実装を最小化）

| 部品 | 場所 | 役割 |
|---|---|---|
| Places クライアント | `src/lib/places.ts`（`fetchNearbySpots`/`fetchSpotDetail`/`PLACES_CATEGORY_MAP`） | 取得の中核 |
| 拡張カテゴリ推定 | `src/lib/places-extended-category.ts`（`extendedCategoryFromPlacesTypes`） | `extended_category` 付与 |
| バルク収集 CLI | `scripts/collect-spots.ts`（`CATEGORY_KEYWORDS` + `upsertSpot`） | 追加処理の原型 |
| ターゲットエリア | `src/constants/target-areas.ts`（115エリア・phase制） | tiling 展開元 |
| 全国座標 | `src/constants/municipality-centers.ts`（全市区町村中心・約2042行）＋`getMunicipalityCenter()` | tiling 中心座標 |
| ランタイム upsert | `POST /api/spots/ensure`（`onConflict: place_id`） | 冪等追加の参照実装 |
| 行補完 CLI | `scripts/enrich-spots.ts` | reconciliation の部分流用 |
| ペット可否バッチ | `src/lib/pet-friendly/verify-batch.ts`（`verifyBatch`/`verifySingleSpot`） | 収集後の連鎖処理 |
| 週次 cron + 認証 | `/api/cron/verify-pet-friendly`＋`CRON_SECRET` Bearer、`vercel.json` crons、GitHub Actions | 定期実行の型 |
| SSE 管理バッチ | `/api/admin/bulk-verify-pet-friendly`＋`PetFriendlyVerificationClient.tsx` | 管理UI進捗の型 |
| 重複防止 | `spots_place_id_unique_idx`（UNIQUE place_id） | upsert 冪等性 |
| 実現可能性 | `src/lib/ai-plan/feasibility.ts`（`checkPlanFeasibility`：DB半径検索でspot_count） | カバレッジ計測の流用元 |

→「収集ロジック」「定期cron」「SSE管理UI」「冪等upsert」はほぼ揃っている。

---

## 3. スキーマ変更（Phase 0）

### 3.1 `spots` への列追加（migration）

```sql
ALTER TABLE spots ADD COLUMN IF NOT EXISTS business_status text;           -- OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY
ALTER TABLE spots ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;     -- Details 最終リフレッシュ
ALTER TABLE spots ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;  -- ソフト削除
ALTER TABLE spots ADD COLUMN IF NOT EXISTS deleted_reason text;            -- 'closed_permanently' 等

CREATE INDEX IF NOT EXISTS spots_last_synced_idx ON spots (last_synced_at NULLS FIRST)
  WHERE is_deleted = false;
```

- **注意**: リポジトリに `CREATE TABLE spots` のベース DDL が無い（ALTER 群のみ）。この機会に `supabase/migrations` にベース DDL を明文化し、単一ソースオブトゥルース化することを推奨。
- 既存の読み出し（`recommend`/`hot`/`feasibility`）に `is_deleted = false` フィルタを追加。

### 3.2 収集状態テーブル `area_coverage`

```sql
CREATE TABLE area_coverage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefecture    text NOT NULL,
  municipality  text NOT NULL,
  tile_key      text NOT NULL,             -- 例: "lat,lng,radius" のグリッドセル
  center_lat    double precision NOT NULL,
  center_lng    double precision NOT NULL,
  radius_m      integer NOT NULL,
  categories    text[] NOT NULL,
  status        text NOT NULL DEFAULT 'pending',   -- pending / collecting / done / error
  last_collected_at timestamptz,
  found_count   integer DEFAULT 0,
  inserted_count integer DEFAULT 0,
  api_calls     integer DEFAULT 0,
  phase         integer NOT NULL DEFAULT 3,
  UNIQUE (prefecture, municipality, tile_key)
);
CREATE INDEX area_coverage_status_idx ON area_coverage (status, phase, last_collected_at NULLS FIRST);
```

---

## 4. 全国カバレッジ定義（Phase 1）

### 4.1 tiling 生成（1回限りのシード）

- `MUNICIPALITY_CENTERS`（全市区町村）を起点に、各エリアを **半径グリッド**で分割。
  - 小規模市区町村: 中心1点・半径 ~3km。
  - 大規模/政令市: 中心 + リング状に複数タイルを配置（半径 ~2km で重複オーバーラップ）。重複は `place_id` UNIQUE で吸収。
- 各タイルに収集カテゴリ（`collect-spots.ts` の `CATEGORY_KEYWORDS`：公園/カフェ/レストラン/宿泊/ペットショップ/動物病院/ドッグラン等）を割り当て。
- 結果を `area_coverage` に `status='pending'` で一括投入する **生成スクリプト** `scripts/seed-area-coverage.ts` を新設。
- 既存 `TARGET_AREAS`（115）は phase1/2 として優先実行、残り全国は phase3 として生成。

### 4.2 カバレッジ計測

- `checkPlanFeasibility` と同じ「緯度経度ボックス＋haversine」で、エリア内の `is_deleted=false` 件数を集計するヘルパを共通化。
- 管理画面に「全国 done 率 / 総スポット数 / 未収集エリア数」を表示。

---

## 5. 自動追加 cron（Phase 2）

### 5.1 ルート `/api/cron/collect-spots`（新規）

```
POST /api/cron/collect-spots
Authorization: Bearer ${CRON_SECRET}
```

処理（1実行 = 予算上限内で前進）:
1. `area_coverage` から `status IN ('pending','error')` を `phase ASC, last_collected_at NULLS FIRST` で **最大 N タイル**取得。
2. 各タイル: `status='collecting'` にして、カテゴリ毎に Text/Nearby Search（`keyword:'犬'`, `language:'ja'`, `next_page_token` 最大3ページ）。
3. 取得結果を **upsert**（`onConflict: place_id`）。`ensure` と列を統一し、`prefecture`/`municipality`/`source='places_collector'`/`collected_at`/`last_synced_at` を必ず書く。
   - **重要**: 現行 `collect-spots.ts` は「pre-check + insert」。reconciliation と整合させるため upsert + `collected_at` 更新へ変更。
4. タイル結果を `area_coverage` に記録（`found_count`/`inserted_count`/`api_calls`/`status='done'`）。
5. 予算 or 時間（Vercel 290s）に達したら停止。次回 cron が続きから前進。
6. 任意: そのバッチで新規追加された spot に対し `verify-pet-friendly` を連鎖（既存 `verifyBatch` を呼ぶ）。

### 5.2 スケジュール（`vercel.json` crons に追加）

```json
{ "path": "/api/cron/collect-spots", "schedule": "0 16 * * *" }   // 毎日 01:00 JST 想定
```

- 全 pending が done になるまで毎日少しずつ前進（=「全部登録されるまで自動追加」）。
- Vercel cron の実行時間制限が厳しい場合は GitHub Actions（`bulk-verify` と同じ `ADMIN_BASIC_AUTH_BASE64` / `CRON_SECRET` 方式）で反復呼び出しに切替。

### 5.3 可変ペース（上限付き自動化 ＋ 後からリミット解除）

**既定 = 無料枠ドリップ（ほぼ¥0）／必要時だけスイッチでアクセラレート**。コード変更・再デプロイなしで設定値だけで切り替える。

**3つのコントロール（env または DB 制御行 `collect_config`、管理UIトグル）**

| つまみ | 役割 | 値の例 |
|---|---|---|
| `enabled` | 収集 ON/OFF | true / false |
| `pace` | ペース | `free_tier`（無料枠内）/ `accelerated` / `unlimited`（上限なし） |
| `daily_api_budget` | 1日の API コール上限 | 例: free_tier=4,500（検索5,000無料枠の内側）、unlimited=∞ |

**日次使用量レジャー**

```sql
CREATE TABLE collect_usage (
  usage_date date PRIMARY KEY,
  search_calls integer NOT NULL DEFAULT 0,
  details_calls integer NOT NULL DEFAULT 0
);
```

- collect/reconcile cron は実行のたびに**今日の累計**を `collect_usage` で確認し、`daily_api_budget` に達したら以降スキップ（複数回実行・GitHub Actions 連打でも超過しない）。
- 残予算ぶんだけ `area_coverage` の `pending` を処理 → `api_calls` を記録 → 上限到達で停止。`area_coverage` のカーソルで**途中再開が常に安全**（何ヶ月かけてもOK）。

**後からリミット解除**

- `pace=unlimited` に変更、または `daily_api_budget` を引き上げるだけ。**次回実行から即反映**。
- 急ぎの一括は管理UIの「今すぐ N 件収集（SSE）」ボタンで cron とは別に手動バースト。
- GitHub Actions は `workflow_dispatch` で手動連打も可能。

**その他**

- `PAGE_TOKEN_DELAY_MS`（既存 2100ms）を踏襲。
- 無料枠目安: 検索 5,000/月・Place Details 5,000〜（Essentials 10,000）/月。`free_tier` ペースはこの内側に収める。

---

## 6. 定期チェック / 差分同期 cron（Phase 3）

### 6.1 ルート `/api/cron/reconcile-spots`（新規）

処理（1実行 = 上限内）:
1. `is_deleted=false` を `last_synced_at NULLS FIRST` 古い順に **最大 M 件**取得（30日リフレッシュ要件を満たす件数を逆算）。
2. 各 `place_id` を Place Details 再取得。
   - フィールド更新（name/address/rating/price_level/photo_ref/google_types/opening_hours 等）。
   - `business_status` を保存。`CLOSED_PERMANENTLY` → `is_deleted=true`, `deleted_reason='closed_permanently'`。
   - Details が `NOT_FOUND`/`INVALID` → 連続失敗で `deleted_reason='not_found'`。
   - `last_synced_at = now()`。
3. （任意）「登録数チェック」: エリア単位で `found_count` の増減を検知し、減少が大きいエリアを再収集キュー（`area_coverage.status='pending'`）へ戻す。

### 6.2 スケジュール

```json
{ "path": "/api/cron/reconcile-spots", "schedule": "0 17 * * *" }  // 毎日 02:00 JST
```

- 「全エリア done 後は定期チェックで追加/削除」を担う本体。
- 追加（再収集）と削除（閉店検知）の両方をここ＋collect cron で循環させる。

---

## 7. 管理ダッシュボード（Phase 4）— 記事管理と統合（実装済み）

- `AdminLayoutShell` ナビに **記事 / ペット可否 / スポット収集** を統合。
- `/admin/spot-coverage` — 完了率・本日API使用量・ペース切替（`free_tier` / `accelerated` / `unlimited`）・手動収集 SSE。
- 設定は `collect_config` テーブル（コード変更不要でリミット解除可能）。

**結論: 既存の管理画面とタブ切り替えで統合できる（むしろ既存設計がそうなっている）。**

- `/admin` 配下は全ページが共通の `src/components/AdminLayoutShell.tsx`（sticky ヘッダーナビ）に包まれている。現状ナビは `記事` のみだが、ペット可否ページは `記事管理へ` 相互リンクを持ち、同一エントリ前提の作り。
- 統合は `AdminLayoutShell` の `<nav>` に `ペット可否` / `スポット収集` リンクを足すだけ（数行）。認証・レイアウト・スタイルは全ページ共通。
- 新規 `/admin/spot-coverage`:
  - 全国 done 率・総件数・未収集/エラーエリア一覧。
  - 「手動で N タイル収集」「特定都道府県を再収集」ボタン（SSE 進捗）。
  - 既存 SSE パターン（`/api/admin/bulk-verify-pet-friendly` + `PetFriendlyVerificationClient.tsx`）を流用。
  - 認証: `requireAdminAuth()` + `verifySameOrigin()`（既存と同一）。

```
推奨 admin 構成（同一入口・タブ切替）:
  /admin/articles            ← 記事
  /admin/pet-friendly-verification ← ペット可否
  /admin/spot-coverage       ← スポット収集（新規）
```

---

## 8. ガードレール

- **認証**: cron は `CRON_SECRET` Bearer、管理 API は `requireAdminAuth`。
- **冪等性**: 全書き込み upsert（`onConflict: place_id`）。再実行安全。
- **予算**: 実行毎の件数・API コール上限を env 化。日次集計でサーキットブレーカ。
- **ToS 準拠**: `place_id` 永続・他フィールド ≤30日リフレッシュ（reconcile が保証）。
- **ソフト削除**: 物理削除しない（レビュー/いいね等の参照整合のため）。`is_deleted` で除外。
- **可観測性**: `area_coverage` に `api_calls`/`found_count`/`inserted_count`、cron ログ。

---

## 9. ロールアウト順序

1. **Phase 0**: migration（`business_status`/`last_synced_at`/`is_deleted` + `area_coverage`）。読み出し系に `is_deleted=false` フィルタ追加。
2. **Phase 1**: `seed-area-coverage.ts` で全国 tiling 投入（dry-run で件数・推定 API コストを先に確認）。
3. **Phase 2**: `/api/cron/collect-spots` + `vercel.json` 追加。小さい予算で試走 → 段階的に上限を上げて全国を埋める。
4. **Phase 3**: `/api/cron/reconcile-spots`。
5. **Phase 4**: `/admin/spot-coverage` SSE UI。

---

## 10. 事前に解消すべき既知の課題

- **作業ツリーの欠落**: `wanspot` の working tree で `vercel.json` / `src/lib/places.ts` / `scripts/collect-spots.ts` 等が削除状態（git HEAD にのみ存在）。実装前に `git restore` で整合を取る。
- **`spots` ベース DDL 不在**: Phase 0 でベース DDL を migration 化。
- **upsert 戦略の不一致**: `ensure`（upsert）と `collect-spots`（pre-check+insert）を upsert に統一。
- **コスト見積り**: Phase 1 dry-run でタイル数 × カテゴリ数 × 平均ページ数から月間 API コール/費用を試算し、上限を決めてから本走。

---

## 11. コスト概算（Google Places）

現行 SKU 料金（旧 web service Places API 相当・2026時点）: 検索（Nearby/Text）**$32/1000**、Place Details **$17/1000**（+Contact $3 / +Atmosphere $5）、Photo **$7/1000**。各 SKU に毎月無料枠（検索5,000・Details 5,000・Details Essentials 10,000）。為替 **¥150/$** 想定。

### 初回の全国一括登録（1回限り）

| 項目 | 件数目安 | 単価 | 概算 |
|---|---|---|---|
| 検索（Text/Nearby） | 2.5万〜5万 req | $32/1000 | $0.8k〜1.6k |
| Details（ペット可否検証で1スポット1回） | 5万〜15万 spot | $17〜25/1000 | $1k〜3.5k |
| **合計（Google のみ）** | | | **約 $2k〜5k ＝ ¥30万〜75万**（中央値 ¥30〜45万） |

※ 別途、ペット可否判定の Claude（Anthropic）LLM 課金がスポット数ぶん発生（Google とは別請求）。

### 運用フェーズ（毎月）

| 項目 | 目安 | 単価 | 概算 |
|---|---|---|---|
| 増分の新規収集 | 数千 req | $32/1000 | <$100 |
| 定期チェック（reconcile・軽量フィールド） | カタログ件数 ÷ 30日 | $5/1000（Details Essentials） | $200〜500 |
| **合計** | | | **約 $300〜600/月 ＝ ¥4.5万〜9万/月** |

### コストを左右する最大ポイント

- 月額の主役は **30日リフレッシュ（ToS 要件）**。10万件をフルフィールド Details で毎月更新すると $1,700/月にもなる → **閉店検知＋座標等の最小フィールドマスク（Essentials $5/1000）**で $500/月以下に抑える。
- 現行 `fetchSpotDetail` は `reviews/opening_hours/website/phone` まで要求して高 SKU 帯。**reconcile 専用の最小フィールドマスク**を別途用意する。
- タイル数・ヒット件数は推測値。**Phase 1 の dry-run で実タイル数・想定スポット数・推定 API 数を集計**し、確定見積りと月額上限を決めてから本走する。

## 12. 未決定事項（要判断）

- 実行基盤: **Vercel cron 単独** か **GitHub Actions 反復呼び出し** か（全国を埋める総時間 vs 1実行制限）。
- カテゴリ集合の最終確定（既存 `CATEGORY_KEYWORDS` をそのまま全国展開してよいか）。
- 月間 API 予算上限（コストキャップの具体値）。
- reconcile の頻度（全件30日一巡を満たす日次件数）と、閉店判定の連続失敗しきい値。
