# 「きょうのログ」(P3) + ワンタップVlog提案 (P6) 設計書

作成日: 2026-07-04
対象: wanspot アプリ本体（wanspot-native）+ サーバー（wanspot / Supabase）
前提: `docs/setlog-vlog-improvement-proposal.md` の P3 / P6 / P7（P7は設計上の拡張ポイントのみ）

---

## 1. 棲み分けの定義 — 「スポット訪問レビュー」と「きょうのログ」

### ユーザーから見た違い

| | スポット訪問レビュー（現行） | きょうのログ（新規 P3） |
|---|---|---|
| きっかけ | スポットに行った（お出かけの日） | 犬との日常の一瞬（毎日） |
| 入口 | スポット詳細「行った記録」→ アルバムのレビューカード | アルバムタブ先頭の常設エントリカード |
| 記録の重さ | ★評価 + ひとことメモ + 写真/動画 最大10点 | **写真1枚 or 短い動画1本 + 気分スタンプだけ**（E1: 完璧を求めない） |
| 記録の文脈 | どのスポットか | 犬の生活リズム: **おさんぽ / ごはん / おひるね / おうち / おでかけ**（Setlogの「1時間ごと」の直訳はしない） |
| 保存先 | `visits`（spot_id あり）+ `memories` | **同じ `visits` + `memories`**（spot_id なし・context あり） |

### どう合流するか（必須要件）

- **独立アルバムは作らない**。日次ログは保存した瞬間から既存のレビューアルバム（`ReviewAlbumTimeline` のカードデッキ）に時系列で混ざって並び、**そのまま既存のVlog素材プールに入る**（過去のデイリーフォト機能が体験分断で廃止された教訓）。
- アルバム上では日次ログのカードはスポット名の代わりにコンテキストラベル（「おさんぽ」等）+ 気分スタンプを表示する。それ以外の振る舞い（詳細表示・メディア追加・削除・Vlog選択）はレビューカードと完全に同一。
- Vlog生成の選択UI・液体ゲージ・品質ゲート・EDL・通知（◯ヶ月前の今日）も、日次ログを「スポットに行かなかった日の1プレート」として同じ土俵で扱う。

一言でいうと: **「レビュー = お出かけの日のプレート」「きょうのログ = おうちの日のプレート」で、アルバムとVlogから見ればどちらも同じ1枚のプレート**。

---

## 2. データモデル

### 現行スキーマ（リモートDBを実確認済み）

- `visits`: `id / user_id / spot_id (NOT NULL, FK→spots) / visited_at / comment / rating / soft_deleted / created_at / source (CHECK: detail_button|review|checkin|other)`
- `memories`: `id / user_id / visit_id (FK→visits) / spot_id (NOT NULL, FK→spots) / media_url / media_type / thumbnail_url / soft_deleted / created_at`
- RLS: 両テーブルともユーザー単位（auth.uid() = user_id）。Storage `memories` バケットは `{userId}/...` プレフィックスで所有チェック。

### 選択肢の比較

| 案 | 内容 | 利点 | 欠点 |
|---|---|---|---|
| **(a) spot_id を nullable 化 + context 列**（採用） | `visits.spot_id` / `memories.spot_id` の NOT NULL を外し、`visits.context`（記録コンテキスト）と `visits.mood`（気分スタンプ）を追加 | 純粋に追加的でリモート適用可。既存行・既存insertは無変更で動く。visits/memories を読む既存コード（アルバム・Vlog・通知・サーバー集計）が**1つのテーブルのまま**日次ログを取り込める。RLS・Storageポリシー変更なし | クライアントで「spotなしvisit」の表示合成が必要。サーバーのEDLスキーマは `spotId: uuid` 必須のため代替IDが必要（→ visit.id を流用、下記） |
| (b) 内部擬似スポット | `spots` に「おさんぽ」等の内部行を作り既存構造のまま参照 | クライアント変更が最小 | `spots` は検索・AIプラン・収集パイプライン・人気度集計が読む**公開共有テーブル**であり、擬似行の混入はそれら全てにフィルタ追加を要求する。汚染リスクが最も高い |
| (c) 別テーブル（daily_logs） | 専用テーブルを新設 | スキーマがきれい | 「素材プールに合流」という必須要件に反し、アルバム表示・Vlog選定・品質ゲート・通知の**全コードパスに二重実装**が必要。廃止済みデイリーフォトの分断を繰り返す |

### 採用: 案(a) の詳細

```sql
-- 追加的変更のみ（既存データの書き換えなし）
alter table visits alter column spot_id drop not null;
alter table visits add column context text null;  -- 日次ログの記録コンテキスト
alter table visits add column mood text null;     -- 気分スタンプ
-- context CHECK: 'walk','meal','nap','home','outing','event'  ← 'event' はP7拡張ポイント（§4）
-- mood CHECK: 'happy','excited','relaxed','sleepy','yummy'
-- 整合性: spot_id が null の行は context 必須（spot訪問はcontext null のまま）
alter table memories alter column spot_id drop not null;
-- 部分インデックス: 日次ログの当日照会用 (user_id, visited_at desc) where spot_id is null
```

- **1日1コンテキスト1行**: 同日・同コンテキストの記録は同じ `visits` 行に `memories` を追記する（`recordSpotVisit` の「同日・同スポット1回」と同じ流儀）。アルバムが1日で埋まらず、Vlog上も「その日のおさんぽ」が1つのまとまり（擬似スポット）になる。`mood` は最後に押したスタンプで上書き。
- **重複記録防止**: 上記の当日dedupe + クライアントの `saving` ガード（既存 `MemoryComposerModal` と同じ多重タップ対策）。

### 影響範囲の確認結果（壊さないことを確認したパス）

- サーバー `behavior/signals.ts` / `recommend/events.ts`: visits.spot_id を読むが **null ガード済み**（`if (!id) return` / `.filter(Boolean)`）→ 日次ログ行は自然に無視される。
- `SpotDetailScreen`: `eq('spot_id', ...)` 照会のみ → null 行はヒットしない。
- Vlogレンダー API: EDLの `spotId` は「uuidであること」しか要求しない（グルーピング・ピーク特定に使うだけ）→ 日次ログは **visit.id を spotId として流用**（uuid なのでスキーマ変更不要。サーバー無変更）。
- `memories` Storage パス所有チェック（`{userId}/`）: アップロード処理は流用のため無変更。

---

## 3. Vlogへの合流方法

既存パイプライン: レビュー複数選択 → クラウド品質解析 → 2層品質ゲート → EDL構築 → サーバーFFmpegレンダー。日次ログは以下のマッピングで**サーバー変更ゼロ**で乗る:

| EDL要素 | スポットレビュー | 日次ログ |
|---|---|---|
| `spotId`（グルーピングキー） | `plate.spot_id` | `plate.id`（visit uuid をフォールバック） |
| `spotName` / スポット名チップ | スポット名 | コンテキストラベル（「おさんぽ」「おうち」等）。**チップはそのまま出す**（その日のシーン名として機能する） |
| イントロ字幕 | 「◯◯と△△へ」/「◯◯とnスポットのおでかけ」 | 選択が日次ログのみ: 1件「◯◯のきょうのひとこま」複数「◯◯のまいにちのきろく」。混在時はスポット件数のみ数えて既存文言 |
| ひとこと字幕 | visits.comment | 日次ログはコメント無し → 字幕なし（そのまま成立） |
| ★加重の尺配分 | rating | rating null → 既存の既定重み(3)で成立 |
| 選曲 | 平均★ | 既存ロジックのまま（将来: mood → 選曲マッピングは拡張候補、§7） |

- 品質ゲート・救済カット・尺クランプ(10〜35秒)は無変更。日次ログ1件だけ選んでも救済カット機構で成立する。
- `SpotCutSelection` / `VlogMediaCandidate` に `isDailyLog` フラグを伝播し、イントロ字幕の分岐にのみ使用する。

---

## 4. P7（イベントVlog）の拡張ポイント

「イベント」は**記録コンテキストの一種**として設計に予約する。今回実装するのは拡張可能なコンテキスト定義まで:

- DBの `context` CHECK に `'event'` を最初から含める（将来のCHECK緩和migration不要）。
- クライアントは `DailyLogContext` 型に `'event'` を含み、`DAILY_LOG_CONTEXTS`（UI表示用の5種）と分離した定義にする。ラベル解決（`contextLabel()`）は `'event'` も解決できる。
- 将来イベントを実装する際は、(1) `visits.context = 'event'` + イベント参照列（`event_id` 等）の追加、(2) コンテキストピッカーへの「イベント」チップの条件表示（会場QRチェックイン等でアクティブ化）、(3) EDLのイベント演出テンプレ、を追加するだけでよい。**日次ログの保存・アルバム表示・Vlog合流のコードパスはそのまま流用できる**。

---

## 5. DAU導線 — アルバムタブ先頭の常設エントリ

### UI構成（`ReviewAlbumTimeline` 先頭に常設）

1. **きょうのログ エントリカード**（`DailyLogEntryCard`）
   - 未記録（空状態）: 「きょうの◯◯（犬名）をのこそう」+ コンテキストチップ5種（おさんぽ/ごはん/おひるね/おうち/おでかけ）。チップをタップするとそのコンテキストでクイック記録が開く。
   - 記録済み（当日）: 当日の記録サムネイル + 気分スタンプ + 「＋ついか」。何度でも追記できる（E3: 1日複数回のゆるいトリガー）。
2. **クイック記録モーダル**（`DailyLogComposerModal`）
   - コンテキスト切替チップ → メディア1点（カメラ撮影 or ライブラリ。動画はカメラ撮影時 最大10秒）→ 気分スタンプ（5種・任意）→ 保存。**入力はこれだけ**（E1: 超軽量）。
   - 保存後はアルバムに即反映（レビューカードと同じデッキに並ぶ）。

### デザイン（カラートークン v8 restraint 準拠）

- `constants/color-tokens.ts` の `TOKENS`（`constants/colors.ts` 経由）だけを参照し、**ハードコード色を使わない**。
- ベースは紙面: カードは `surface.primary`(#FFFFFF) / 背景 `surface.paper`、文字 `text.primary`/`text.secondary`、枠 `border.default`。
- CTA・アクセントはコーラル `brand.primary`(#FB6B53) ソリッド。チップは `brand.tintWeak` 背景 + `brand.pillText` 文字。
- **グラデーションは使わない**（グラデ許可は液体ゲージ `GRADIENT_VLOG_LIQUID` とアバターリングのみ、という v8 restraint 規約に従う）。
- アニメーションは Reanimated の浮遊・パルス等（単色のまま）で「未来感」を出す。

---

## 6. P6 — レビュー保存直後のワンタップVlog提案

### 体験フロー

1. `MemoryComposerModal` で保存成功（メディアが1点以上あるレビューになった場合のみ）。
2. アルバム上部に **ワンタップ提案カード**（`VlogOneTapOffer`）が出現: 「このレビューでVlogにする？」+ レビューのカバー写真 + 「いますぐつくる」/「あとで」。
3. 「いますぐつくる」→ そのレビュー1件だけを対象に既存の生成フロー（品質ゲート→EDL→サーバーレンダー）へ。1件でも救済カット機構 + 尺クランプ(10〜35秒)で成立する。
4. 既存の複数選択UI（「Vlogを作る」ボタン → 選択モード）はそのまま残す（パワーユーザー向け）。

### デザイン

- VLOG文脈の器 = `brand.vessel`(#1E1B19) のダークカード（`VlogLiquidGauge` と同じ流儀）。白文字 + コーラルCTA。
- グラデは使わず、液体パレット（`GRADIENT_VLOG_LIQUID` の各色）を**単色の光の粒（アクセントドット）**としてのみ使用。出現は FadeInDown + spring、CTAに微パルス。
- 生成中は既存の `VlogGeneratingPanel` に接続。

### 多重タップ・エッジケース

- 生成開始で提案カードを即時クローズ + 既存 `generateBusy` ガードで多重生成防止。
- 保存後のアルバム再読込が完了し、対象レビューにメディアが確認できた時点でのみカードを表示（データ不整合時は出さない）。

---

## 7. 将来案（今回は実装しない）

- **月次ダイジェスト自動提示**（P6後半）: 月末に当月プレートから自動選定済みプレビューを提示 → 確認のみで生成。選定は既存2層ゲートをそのまま月次範囲に適用すればよい。
- **mood → 選曲マッピング**: 日次ログの気分スタンプ多数決で `pickMusicTrack` を上書き（はしゃぎ→genki、まったり/おねむ→cozy 等）。
- **イベントコンテキスト**（P7本体）: §4 の拡張ポイントに従い実装。
- **「◯ヶ月前の今日」通知**は日次ログにも対応済みの文言分岐を入れる（今回実装、通知本文のみ）。

---

## 8. 変更ファイル一覧（実装スコープ）

### サーバー（wanspot）
- `supabase/migrations/20260704020000_visits_daily_log_context.sql` — §2 の追加的migration

### クライアント（wanspot-native）
- `lib/daily-log.ts` — コンテキスト/気分の定義・ラベル・合成SpotMini・判定ヘルパー（新規）
- `lib/visits-memories.ts` — spot_id nullable 対応、`recordDailyLog`、fetch時の日次ログ合成
- `lib/image-picker.ts` — 日次ログ用の1点撮影/選択ヘルパー
- `lib/vlog/quality-gate.ts` / `lib/vlog/build-payload.ts` / `lib/vlog/edl.ts` — グルーピングキーのフォールバックと `isDailyLog` 伝播・イントロ字幕分岐
- `lib/album/vlog-progress.ts` — 液体ゲージ進捗の日次ログ対応
- `lib/notifications/memory-anniversary.ts` — 日次ログ用の通知文言
- `components/album/DailyLogEntryCard.tsx` — アルバム先頭の常設エントリ（新規）
- `components/album/DailyLogComposerModal.tsx` — クイック記録UI（新規）
- `components/album/VlogOneTapOffer.tsx` — P6 ワンタップ提案（新規）
- `components/album/ReviewAlbumTimeline.tsx` — 上記の組み込み + 日次ログカード表示 + 生成フローの単発対応
