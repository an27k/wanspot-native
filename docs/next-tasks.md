# 残タスク（2026-09-01 以降）

セッションが変わっても拾えるように、状況と手順を残す。

---

## 1. 同伴可否の精度を再測定する（最優先・約$4）

### なぜ待っているか
2026-08-31 の支出が $32.84 / 上限 $35.00 まで積み上がったため見送った。
上限に触れると `pauseAllPaidAutomation` が収集・検証・記事生成・カレンダーを一斉に止める。
**日付が変われば枠はリセットされる。**

### 手順
```bash
# 1) 支出がリセットされているか確認（JST当日・occurred_at 列を使う。created_at ではない）
#    $0 付近であること。上限は $35

# 2) 再測定
cd /Users/atsu/Developer/wanspot
# 起動方法はスクリプト冒頭のコメントに書いてある
node --import tsx scripts/eval-pet-policy.ts
```
- 並列2・タイムアウト120秒の既定で流す（下げるとタイムアウトを測ってしまう。README の罠3つを参照）
- 同じ日に2本流すと2本目が SpendBudget に打ち切られる。その場合は `--resume=<前回のjson>` で続行できる

### 何と比べるか
baseline: `eval/pet-policy-baseline.json`
- 主指標（飲食店・公園・ホテル）: **40.0%**
- db_too_permissive: **2.5%**（1件＝新宿区立花園公園）
- db_unknown_but_knowable: **13件** / unknown 18件

### 見るべき点（一致率だけで判断しないこと）
1. **db_too_permissive が 0 になったか** — 花園公園が unknown に落ちたか。これが本命
2. **unknown が何件増えたか** — ドライ集計では 18→22件（45%）の見込み。
   地図の同伴可否バッジと「店内OK」フィルタの母数が減る方向なので、増えすぎなら閾値の再調整が要る
3. **not_allowed が unknown 化していないか** — 引用必須化の副作用。gold の不可2件
   （CAFÉ 杜のテラス・新宿御苑）が消えていないか確認する
4. `pet_search_outcome` の分布 — succeeded 以外がどれくらいあるか

### 注意
一致率が下がっても即「悪化」ではない。baseline のときも、危険な誤り（現地で断られる）が
17.5%→2.5% に減った代わりに保留が増えていた。**誤りの型の移動として読む。**

---

## 2. スクリーンショットと説明ページ（実行中だったもの）

セッション終了時に走っていたワークフローの成果を確認すること。

- **スクショ撮り直し**: `~/Developer/wanspot-app-store-previews/Wanspot-previews-final/1320x2868/`
  build 268 相当・MapKit の地図・チャットのスライド1枚追加。**生成物は必ず目視確認する**
  （Google のロゴが消えているか、テキストの見切れが無いか）
- **説明ページ**: `wanspot/src/app/ai/page.tsx`（https://www.wanspot.app/ai）
  記述が実装と一致しているか要確認。完成したら審査メモにURLを追記する

---

## 3. 提出（材料は揃っている）

| 項目 | 場所 |
|---|---|
| ビルド 2.1.0 (268) | アップロード済み |
| リリースノート | `docs/release-notes-2.1.0.md` |
| プロモーション文・審査メモ（英語） | `docs/appstore-2.1.0-promo-and-review-notes.md` |
| 概要 | `docs/appstore-description-2.1.0.md` |
| App Privacy ラベル | 設定済み（その他のユーザコンテンツ） |
| プライバシーポリシー | 追記・デプロイ済み |
| デモアカウント | atsunari0614@icloud.com（パスワードを審査メモに記入する） |

スクショが差し替わってから提出するのが安全。

---

## 4. そのうち

- **AIレビューの確度バッジ（施策1 Phase 1・3）** — サーバ側の準備は済んでいるが API 出力とUIは未実装。
  設計は `docs/ai-review-trust-and-chat-design.md` §2.2・2.3。
  表示開始の条件は「Phase 2 の改善完了」または「低確度バッジ＋情報提供導線が揃う」の早い方
- **低確度 → 情報提供ループ**（同 §2.6）— 構造化3問のシート。migration は適用済み
  （`spot_info_tips.source` に 'low_confidence_badge' / 'chat_no_answer' が入っている）
- **gold set の100件拡張** — 60件×5〜10分の人手。出荷基準の判定には統計的に必要
- **既知のテスト失敗1件** — `src/lib/ops/autofix/workflow-names.test.ts` が
  `verify-pet-friendly.yml` で落ちる。別作業者の未コミット変更由来で、チャット関連ではない
