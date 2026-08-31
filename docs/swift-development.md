# Swift 版の開発

Swift 版は RN の `ios/` と分離し、`swift/` 配下で管理する。
プロジェクトファイルの正本は `swift/project.yml`。Xcode 上で直接構成を変えず、
変更後は XcodeGen で再生成する。
内部 TestFlight から本番と同じ Bundle ID `app.wanspot.native` を使用する。
RN 版との同時インストールはできないが、App Store 公開版はリリース操作まで変わらない。

## 進捗

- Phase 0: 完了。SwiftUI アプリ、`WanspotKit`、設定、CI を作成済み。
- Phase 1: 完了扱い。`business-hours` の TS → JSON → Swift パリティ検証が通る。
- Phase 2: データ層を実装中。
  - Supabase: users / dogs / dog_photos / visits / memories / spot_likes /
    check_ins / user_events / spot_info_tips
  - Storage: avatars / dog-photos / memories
  - API: 共通 transport、Bearer 認証、タイムアウト、slow path 4本
  - Cache: actor 分離、TTL、同一キーの in-flight 集約、座標丸め、
    スポット詳細の handoff / memory / 15分 stash
- Phase 3: Swift 実装・ローカル検証済み。2.0.0 (253) を TestFlight へ
  2026-08-19 にアップロード済み。実サービス通し確認は未実施。
  - Auth: メール登録/ログイン、Apple ID token、Google OAuth PKCE、
    Keychain セッション、ゲスト継続、既存犬プロフィールによる起動ゲート
  - Onboarding: 愛犬入力、写真、犬種112件、サイズ、誕生日、ワクチン、
    散歩時刻、位置情報、拒否時の全国主要エリア選択、users/dogs 保存
  - 現行RN版の `size` は旧リダイレクト。実動線は `dog` → `location`、
    拒否時のみ `area` → `ready`

`docs/swift-migration-plan.md` の当初集計は棚卸し時の数え方が誤っていたため
訂正済み。`avatars` は Storage バケットで、動的な `.from(TABLE)` の
`dog_photos` が当初検索から漏れていた。API 4本は slow path のみ。
画面固有 API の DTO は該当 Feature Phase で追加する。

## 必要環境

- Xcode 26.6
- XcodeGen 2.46+
- Node.js 24+

```sh
npm ci
npm run swift:fixtures
cd swift
xcodegen generate
swift test --package-path WanspotKit
```

アプリのビルド:

```sh
cd swift
xcodebuild \
  -project Wanspot.xcodeproj \
  -scheme Wanspot \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -scmProvider system \
  -packageAuthorizationProvider netrc \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Google Mobile Ads の binary target 取得時に、`xcodebuild` が Keychain の
非表示ダイアログを待ち続けることがある。公開パッケージだけを使う現在の構成でも
`-packageAuthorizationProvider netrc` を付け、対話待ちを避ける。

## ローカル設定

`swift/Config/Secrets.example.xcconfig` を
`swift/Config/Secrets.xcconfig` にコピーして値を入れる。
後者は git 対象外。xcconfig 内の URL は `https:/$()/example.com` の形で書く。
API / Site URL が空なら `https://www.wanspot.app` を使う。

## Supabase スモークテスト

`users` は RLS により認証済み本人の行だけを SELECT できる。次の環境変数が
すべてある場合だけ、専用テストアカウントでログインして1件取得する。

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`（legacy key は `SUPABASE_ANON_KEY` でも可）
- `WANSPOT_SUPABASE_TEST_EMAIL`
- `WANSPOT_SUPABASE_TEST_PASSWORD`

未設定時はスモークテストだけ skip し、純粋なユニットテストとアプリビルドは実行する。
GitHub Actions では `WANSPOT_SUPABASE_URL`、
`WANSPOT_SUPABASE_PUBLISHABLE_KEY`、`WANSPOT_SUPABASE_TEST_EMAIL`、
`WANSPOT_SUPABASE_TEST_PASSWORD` の4 Secrets を設定する。
