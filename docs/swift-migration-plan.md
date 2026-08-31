# Swift / SwiftUI 移行計画

作成日: 2026-08-18 / 対象: wanspot-native v1.0.2 (build 252)
方針: **ハイブリッド並走** ・ 最低対応 **iOS 26+**

---

## 1. 現状の棚卸し

移行対象を実測した数字。見積もりの根拠はすべてここ。

| 区分 | ファイル数 | 行数 | 移行時の性格 |
|---|---:|---:|---|
| `app/` (ルーティング/画面) | 28 | 5,097 | ナビゲーション構造ごと再設計 |
| `components/` (UI) | 86 | 16,990 | **本丸。** SwiftUI で書き直し |
| `lib/` (ロジック/データ) | 119 | 11,789 | 大半が純ロジック。機械的に移植可 |
| `hooks` / `context` / `constants` / `integrations` / `types` | 19 | 1,164 | 状態管理設計に吸収 |
| 合計 | 252 | **34,040** | |

### 移行を助けている構造上の事実

調査の結果、この移行は当初想像するより条件が良い。

- **iOS 専用**。`android/` ディレクトリは存在せず、`supportsTablet: false`。クロスプラットフォームを捨てるコストがゼロ。
- **動画レンダリングはサーバ側**。`lib/vlog/render-client.ts` が `/api/vlog/render` を叩く構成で、端末上に AVFoundation の合成処理を書く必要がない。移行の最難関になりがちな領域が最初から無い。
- **Skia の使用は 1 コンポーネントのみ** (`components/album/VlogLiquidGauge.tsx`)。
- **地図の使用も 1 ファイルのみ** (`components/map/NearbyMapView.tsx`, 424 行)。
- **バックエンドは移行対象外**。Supabase + Next.js API (`www.wanspot.app`) をそのまま共有できる。Swift 版は同じデータを見る別クライアントになる。
- Supabase は直アクセスが 27 ファイル、実質 **9 テーブル** (`spot_likes` / `visits` / `users` / `dogs` / `dog_photos` / `memories` / `check_ins` / `user_events` / `spot_info_tips`) と **3 Storage バケット** (`avatars` / `dog-photos` / `memories`)。`avatars` はテーブルではなく、当初集計では動的な `.from(TABLE)` を使う `dog_photos` が漏れていた。
- `/api/ai-summary`, `/api/vlog/quality`, `/api/vlog/render`, `/api/walk-line` は **40秒タイムアウトを使う slow path 4本**に過ぎない。実際には spots / places / articles / calendar / account 系を含む少なくとも18の JSON ルート系統と画像プロキシを利用している。共通通信層を Phase 2 で作り、画面固有 DTO は各 Feature Phase で追加する。

### 移行前に落とせるもの

- `react-native-map-clustering` — `package.json` にあるがどこからも import されていない。
- `expo-auth-session` — 同上。Google OAuth は `lib/oauth-supabase.ts` 経由で完結している。

---

## 2. 移行戦略：ハイブリッド並走

新規 Xcode プロジェクトを別に立て、Supabase / Wanspot API を RN 版と共有したまま Swift 版を育てる。RN 版 (v1.0.x) は当面 App Store で生かし続け、Swift 版が機能パリティに達した時点で TestFlight → 段階リリースで差し替える。

```
                  ┌─────────────────────────┐
                  │  Supabase (9 tables)    │
                  │  Wanspot API (4 routes) │
                  └───────────┬─────────────┘
                    ┌─────────┴─────────┐
          ┌─────────▼────────┐  ┌───────▼──────────┐
          │ wanspot-native   │  │ Wanspot (Swift)  │
          │ RN / Expo 55     │  │ SwiftUI / iOS 26 │
          │ App Store 公開中 │  │ TestFlight で育成│
          │ 保守のみ・凍結   │  │                  │
          └──────────────────┘  └──────────────────┘
                    差し替えは一度きり ──────▲
```

**この戦略の要点**

- ブリッジ層 (RN ↔ Swift の相互運用) を一切書かない。段階移行の最大のコストがこれで、ハイブリッド並走はそれを回避する。
- RN 版は**機能凍結**する。両方に新機能を入れ始めた瞬間、移行は永遠に終わらない。凍結できないなら並走ではなく段階移行を選ぶべき。
- リリースは止まらないが、RN 版に入るのはクラッシュ修正と審査対応のみ。
- Phase 3 の内部 TestFlight から bundle identifier `app.wanspot.native` を
  引き継ぐ。Swift 版 2.0.0 は同一アプリの更新になり、TestFlight 端末では
  RN 版を置き換える。App Store 公開版はリリース操作まで変わらない。

**受け入れるリスク**: Swift 版は機能パリティ前から内部 TestFlight で本番
Bundle ID を使う。テスター端末で RN 版との同時インストールはできないが、
公開ユーザーにはリリース日まで届かない。

---

## 3. 技術スタック対応表

iOS 26 を最低ラインにしたことで、代替ライブラリを探す必要がほぼ無くなっている。

### UI / 表現

| 現状 | Swift 版 | 備考 |
|---|---|---|
| `expo-router` (45 ファイル) | `NavigationStack` + `TabView` | 型付き `NavigationPath` でルート定義 |
| `expo-glass-effect` (`components/ui/LiquidGlass.tsx`) | `.glassEffect()` / `GlassEffectContainer` | **iOS 26 ネイティブ。** フォールバック不要 |
| `expo-blur` (3) | `.background(.ultraThinMaterial)` | |
| `react-native-reanimated` (13) | `withAnimation` / `@Animatable` / `PhaseAnimator` | 宣言的アニメへ再設計 |
| `react-native-svg` (22) | Asset Catalog の SVG / SF Symbols / `Path` | **地味に重い。** 大半はアイコンで機械的だが数が多い |
| `@shopify/react-native-skia` (1) | `Canvas` + `ShaderLibrary` | `VlogLiquidGauge` の液体ゲージのみ |
| `expo-image` | `AsyncImage` (+ 必要なら Nuke) | キャッシュ戦略は要検討 |
| `@expo/vector-icons` | SF Symbols | 置き換えできないものだけ Asset 化 |

### データ / プラットフォーム

| 現状 | Swift 版 | 備考 |
|---|---|---|
| `@supabase/supabase-js` (8) | **supabase-swift** | Auth / PostgREST / Storage / Realtime すべて公式対応 |
| `AsyncStorage` (認証セッション) | Keychain (supabase-swift 既定) + `UserDefaults` | セッション永続化は SDK 任せ |
| `expo-constants` の `extra` | `.xcconfig` + `Info.plist` | `app.config.js` の env 解決ロジックを移植 |
| `expo-location` (8) | CoreLocation | `isIosBackgroundLocationEnabled: false` を維持 |
| `expo-notifications` (3) | UserNotifications | ローカル通知3種 (`memory-anniversary`, `walk-advice-morning`, deeplink) |
| `expo-apple-authentication` | `SignInWithAppleButton` (AuthenticationServices) | |
| Google OAuth (`lib/oauth-supabase.ts`) | `ASWebAuthenticationSession` + supabase-swift | PKCE フローを維持 |
| `expo-image-picker` (2) | `PhotosPicker` | |
| `expo-image-manipulator` (2) | Core Image / `UIGraphicsImageRenderer` | |
| `expo-media-library` (2) | `PHPhotoLibrary` | Vlog のカメラロール保存 |
| `expo-video` (4) | `VideoPlayer` (AVKit) | |
| `expo-sharing` | `ShareLink` | |
| `expo-file-system` (1) | `FileManager` | |
| `expo-haptics` (3) | `.sensoryFeedback()` | |
| `react-native-google-mobile-ads` (7) | Google Mobile Ads SDK for iOS | ネイティブ広告。`GADNativeAdView` を `UIViewRepresentable` で包む |
| Amplitude (`lib/analytics.ts`) | Amplitude Swift SDK | イベント名は完全据え置き（計測の連続性） |

### 地図 — 唯一の要判断ポイント

現状は `PROVIDER_GOOGLE` を明示して Google Maps を使っている (`NearbyMapView.tsx:316`)。Swift 版で選択肢は2つ。

- **MapKit for SwiftUI** — SwiftUI 統合が圧倒的に自然、API キー不要、コスト0、Liquid Glass との親和性も高い。ただし地図の見た目が変わる。
- **Google Maps SDK for iOS** — 見た目の連続性は保てるが、`UIViewRepresentable` でラップすることになり SwiftUI の旨味が減る。API キーのコストも継続。

**推奨は MapKit。** スポットデータ自体は Supabase / Wanspot API 持ちで Google Places に地図描画を依存していないため、乗り換えの実害が「地図タイルの見た目が変わる」だけに収まる。Phase 4 の頭でプロトタイプを作り、実物を見て最終判断する。

---

## 4. アーキテクチャ

```
swift/
├── Wanspot.xcodeproj
├── project.yml            ← XcodeGen の正本
├── Config/                ← xcconfig
├── WanspotKit/            ← Swift Package (UI 非依存・テスト対象)
│   ├── Models/            spots, dogs, visits, memories, events …
│   ├── Domain/            lib/ の純ロジック移植先
│   │   ├── Weather/       walk-daily-advice, walk-environment (1,471 行)
│   │   ├── Nearby/        (1,094 行)
│   │   ├── Articles/      article-feed-ranking (491 行)
│   │   ├── Calendar/      business-hours, walk-area-catalog
│   │   └── Vlog/          edl, duration, quality-gate
│   ├── Data/
│   │   ├── SupabaseClient      supabase-swift
│   │   ├── WanspotAPIClient    共通通信層 + slow path 4本の型付きAPI
│   │   └── Cache/              client-cache, geo-cache, spot-detail-cache 相当
│   └── Tests/             ← パリティテスト（後述）
└── Wanspot/               ← アプリ本体 (SwiftUI)
    ├── App/               エントリ、TabView、ルーティング
    ├── Features/          画面単位。Search / Articles / Calendar / Album / MyPage …
    ├── DesignSystem/      LiquidGlass, AppHeader, PressableScale, 配色, タイポ
    └── Platform/          Location, Notifications, Ads, Analytics, Photos
```

**状態管理**: `@Observable` マクロ + `@State` / `@Environment`。Feature ごとに `@Observable` な Store を1つ置き、`WanspotKit` の関数を呼ぶだけの薄い層にする。Redux 的なものは持ち込まない。

**並行処理**: async/await + `actor` に統一。`lib/promise-timeout.ts` 相当はタスクのキャンセルで表現する。Combine は使わない。

### パリティテスト（この計画の肝）

`lib/` の純ロジックは、TS 実装が**すでに本番で正しく動いている仕様書**そのもの。これを捨てずに使う。

1. TS 側に「入力→出力」を JSON で吐くスクリプトを書く (既存の `eval/`, `.review-dataset-100.json` と同じ発想)。
2. そのフィクスチャを `swift/WanspotKit/Tests` のリソースに置く。
3. Swift 実装が同じ入力に同じ出力を返すことをテストする。

対象は最低でも: 天気アドバイス生成、周辺スポットのソート/フィルタ、記事フィードのランキング、営業時間判定、Vlog の EDL 生成。ここが一致していれば「Swift 版だけ挙動が違う」というクレームの大半を事前に潰せる。

---

## 5. フェーズ計画

見積もりは「1人・フルタイム相当」の粗い幅。順序が重要で、日数はあくまで相対規模の目安。

### Phase 0 — 基盤 (約1週)
- 新規 Xcode プロジェクト作成、iOS 26 ターゲット、`WanspotKit` パッケージ分離
- 初期開発は `app.wanspot.native.swift` で分離し、Phase 3 の内部 TestFlight
  開始時に本番 ID `app.wanspot.native` へ切り替える
- 依存追加: supabase-swift, Google Mobile Ads, Amplitude
- `.xcconfig` で `app.config.js` の env 解決を再現
- CI (Xcode Cloud か GitHub Actions) でビルド + テスト
- **完了条件**: 空のタブが3つ立ち上がり、CI が緑

### Phase 1 — ドメイン層 (約2〜3週) ★ここを最初にやる
- `lib/` の純ロジックを `swift/WanspotKit/Domain` へ移植
- 同時にパリティテストのフィクスチャを TS 側から生成し、テストを書く
- UI を1行も書かずに、アプリの「頭脳」が全部移り、しかも検証済みになる
- **完了条件**: 対象ロジックのパリティテストが全て通る

### Phase 2 — データ層 (約2週)
- supabase-swift で 9 テーブル + 3 Storage バケットのアクセスを実装。RLS 前提を RN 版と突き合わせる
- `WanspotAPIClient` に認証ヘッダー、12秒/40秒タイムアウト、エラー処理を集約。slow path 4本を型付き実装し、画面固有APIは該当 Feature Phase で DTO を追加
- キャッシュ層 (`client-cache` / `geo-cache` / `spot-detail-cache` 相当)
- **完了条件**: テストから実データを取得してモデルにデコードできる

### Phase 3 — 認証 + オンボーディング (約2週)
- Sign in with Apple / Google OAuth / ゲスト継続 (`continue-as-guest.ts`)
- 現行オンボーディングを移植。実動線は `dog` → `location` → 完了、位置情報拒否時のみ `area` → `ready`。`size` は旧ルートから `dog` へのリダイレクトで、サイズ入力自体は `dog` 内に統合済み
- **完了条件**: 新規登録から `onboarding-complete` まで通る。**TestFlight 内部配布を開始し、以降は自分で毎日使う**
- 2026-08-19: 2.0.0 (253) を内部 TestFlight 用にアップロード

### Phase 4 — 検索 / 地図タブ (約3〜4週) ★最難関
- `app/(tabs)/index.tsx` (860 行) + `NearbyMapView` (424 行) + `NearbySpotCarousel` + `MapFilterBar` + `WalkAlertModal` (377 行)
- 冒頭で **MapKit vs Google Maps のプロトタイプ判断**を済ませる
- `GlassTabBar` / `AppHeader` / `LiquidGlass` など DesignSystem の土台もここで固まる
- **完了条件**: アプリの主動線（開く→近くのスポットが見える）が Swift 版で成立

### Phase 5 — スポット詳細 (約2〜3週)
- `SpotDetailScreen.tsx` (1,728 行) — 単体で最大級。いいね / チェックイン / メモ / 共有 / AI サマリ
- **完了条件**: 地図・リスト・ディープリンクの全経路から詳細に入れる

### Phase 6 — カレンダー / まとめ記事 (約3週)
- `CalendarTabScreen` (500) + `app/calendar/[slug]` (362)
- `ArticlesTabScreen` (462) + `ArticleDetailScreen` (883)
- **完了条件**: 2タブが機能

### Phase 7 — アルバム / Vlog (約3〜4週)
- `ReviewAlbumTimeline.tsx` (2,260 行) — **単体最大**。`AlbumMosaic`, `DailyLogComposerModal`, `VlogGeneratingPanel`, `VlogUnlockPanel`, `VlogOneTapOffer`
- `VlogLiquidGauge` の Skia → `Canvas` + Shader 移植
- `app/vlog/preview.tsx` (361) と `expo-video` → `VideoPlayer`
- レンダリング自体はサーバ側なので、ここは**UI と状態遷移だけ**の勝負
- **完了条件**: レビュー投稿から Vlog 生成・保存・共有まで通る

### Phase 8 — マイページ / 設定 / 広告 / 通知 (約2〜3週)
- `mypage` (307) + 設定各画面 + `DogIdentityProfile` (1,131 行) + `likes` / `checkins` / `account-delete`
- ネイティブ広告 (`NativeAdStandardCard`, `ListAdSlot`, `list-injection`) + ATT
- ローカル通知3種 + ディープリンク
- Amplitude イベントの網羅確認
- **完了条件**: 機能パリティ達成

### Phase 9 — 切り替え (約2週)
- 実機での通しテスト、パフォーマンス計測、審査対応 (ATT / 権限文言 / `PrivacyInfo.xcprivacy`)
- TestFlight で育てた `app.wanspot.native` の 2.0.0 を最終ビルドへ更新して提出
- App Store Connect の段階リリースで 1% → 100%
- RN 版リポジトリをアーカイブ

**合計: 概ね 5〜6ヶ月**（1人フルタイム換算）。Phase 4・5・7 の3つで全体の半分近くを占める。

---

## 6. 判断が必要な論点

| # | 論点 | 推奨 | 決める時期 |
|---|---|---|---|
| 1 | 地図を MapKit にするか Google Maps を維持するか | MapKit | Phase 4 冒頭 |
| 2 | RN 版を本当に機能凍結できるか | 凍結する。できないなら戦略を再考 | **今** |
| 3 | 画像キャッシュを標準 `AsyncImage` で足りるか | まず標準、遅ければ Nuke | Phase 5 |
| 4 | ローカル永続化に SwiftData を使うか | 使わない。既存キャッシュ相当を軽量に | Phase 2 |
| 5 | iOS 26 未満のユーザーへの対応 | RN 版を App Store 上で下位互換バイナリとして残す判断もあり得る | Phase 9 前 |

論点 5 は無視できない。iOS 26+ に上げると現行 15.1 のユーザーの一部が更新を受け取れなくなる。Phase 9 の前に App Store Connect の OS バージョン分布を必ず確認すること。

---

## 7. 最初の一歩

Phase 0 を今日始めるなら、この順で。

1. `react-native-map-clustering` と `expo-auth-session` を `package.json` から削除（現状の掃除）
2. Xcode で新規プロジェクト `Wanspot` を作成（iOS 26, SwiftUI, Bundle ID `app.wanspot.native.swift`）
3. `WanspotKit` を Swift Package として切り出し
4. supabase-swift を追加し、`users` テーブルを1件読むだけのテストを通す — **これが通れば移行の技術的な不確実性は8割消える**
5. Phase 1 の1本目として `lib/business-hours.ts` を選ぶ。小さく、純粋で、パリティテストの型を作るのにちょうどいい

---

## 付録: 画面インベントリ

| 画面 | 実装 | 行数 | Phase |
|---|---|---:|---|
| 検索/地図タブ | `app/(tabs)/index.tsx` + `components/map/*` | 860+ | 4 |
| スポット詳細 | `SpotDetailScreen.tsx` | 1,728 | 5 |
| アルバムタイムライン | `ReviewAlbumTimeline.tsx` | 2,260 | 7 |
| 犬プロフィール | `DogIdentityProfile.tsx` | 1,131 | 8 |
| 記事詳細 | `ArticleDetailScreen.tsx` | 883 | 6 |
| オンボーディング(犬) | `app/onboarding/dog.tsx` | 657 | 3 |
| 周辺リスト | `NearbyListScreen.tsx` | 694 | 4 |
| カレンダータブ | `CalendarTabScreen.tsx` | 500 | 6 |
| 記事タブ | `ArticlesTabScreen.tsx` | 462 | 6 |
| カレンダー詳細 | `app/calendar/[slug].tsx` | 362 | 6 |
| Vlog プレビュー | `app/vlog/preview.tsx` | 361 | 7 |
| マイページ | `app/(tabs)/mypage.tsx` | 307 | 8 |
| いいね一覧 | `app/likes.tsx` | 322 | 8 |
| チェックイン一覧 | `app/checkins.tsx` | 298 | 8 |
| ログイン | `app/(auth)/login.tsx` | 284 | 3 |
| その他オンボーディング | `location` / `area` / `ready`（`size` は旧リダイレクト） | ~350 | 3 |
| 設定各画面 | `app/settings/*`, `account-delete` | ~300 | 8 |
