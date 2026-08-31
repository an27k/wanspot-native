# Cursor 実装指示書 — Swift / SwiftUI 移行

前提資料: `docs/swift-migration-plan.md`（全体計画・見積もり・調査結果）
この文書は **Cursor 上のエージェントが単独で着手できる形の作業指示**。計画の背景は上記を読むこと。

---

## 0. 状況の要約

`wanspot-native` は React Native / Expo SDK 55 製の **iOS 専用**アプリ。App Store 公開中（v1.0.2 / build 252）。
これを **Swift + SwiftUI（最低 iOS 26）** に書き直す。

**戦略は「ハイブリッド並走」**。

- 新規 Xcode プロジェクトを別に立てる。RN ↔ Swift のブリッジは**一切書かない**。
- バックエンド（Supabase / Next.js API `www.wanspot.app`）は**移行対象外**。Swift 版は同じデータを見る別クライアント。
- RN 版は機能凍結。クラッシュ修正と審査対応のみ。
- Phase 3 の内部 TestFlight から本番 Bundle ID `app.wanspot.native` を使用する。
  2.0.0 はテスター端末の RN 版を置き換えるが、App Store 公開版は
  リリース操作まで変わらない。

### 規模（実測）

| 区分 | ファイル | 行数 |
|---|---:|---:|
| `app/`（ルーティング・画面） | 28 | 5,097 |
| `components/`（UI） | 86 | 16,990 |
| `lib/`（ロジック・データ） | 119 | 11,789 |
| その他 | 19 | 1,164 |
| **合計** | **252** | **34,040** |

### 移行対象の外部依存の全体像

- Supabase 直アクセス: 27 ファイル / **9 テーブル + 3 Storage バケット**
  - tables: `spot_likes` `visits` `users` `dogs` `dog_photos` `memories` `check_ins` `user_events` `spot_info_tips`
  - buckets: `avatars` `dog-photos` `memories`（`avatars` はテーブルではない。当初集計では動的な `.from(TABLE)` の `dog_photos` が漏れていた）
- `/api/ai-summary` `/api/vlog/quality` `/api/vlog/render` `/api/walk-line` は **40秒タイムアウトの slow path 4本**。このほか spots / places / articles / calendar / account 系を含む少なくとも18の JSON ルート系統と画像プロキシがある。共通通信層を Phase 2、画面固有 DTO を各 Feature Phase で実装する。
- **動画レンダリングはサーバ側**。端末に AVFoundation の合成処理を書く必要はない。

---

## 1. 禁止事項

守られないと移行が破綻する。例外を作らないこと。

- **RN 版に新機能を足さない。** 両方に機能を入れ始めると移行は永遠に終わらない。
- **RN ↔ Swift のブリッジ層を書かない。** 並走戦略の意味が消える。
- **バックエンド（Supabase スキーマ / Next.js API）を変更しない。** RN 版が本番で動いている。
- **既存の Amplitude イベント名を変えない。** 計測の連続性が切れる。`lib/analytics.ts` の定義が正。
- **UI を先に作らない。** Phase 1（ドメイン層）を飛ばして画面から入ると、ロジックの検証手段を失う。
- **Combine を使わない。** async/await + `actor` に統一。
- **SwiftData を使わない。** 既存のキャッシュ層相当を軽量に実装する。
- **Redux 的なグローバルストアを持ち込まない。** Feature ごとの `@Observable` Store のみ。
- **色・角丸・余白をハードコードしない。** `constants/color-tokens.ts` / `constants/gradients.ts` を Swift 側 DesignSystem に写し、そこを正とする。

---

## 2. プロジェクト構成

```
swift/
├── Wanspot.xcodeproj
├── project.yml            ← XcodeGen の正本
├── Config/                ← xcconfig
├── WanspotKit/            ← Swift Package。UI 非依存・テスト対象
│   ├── Models/            spots, dogs, visits, memories, events …
│   ├── Domain/            lib/ の純ロジック移植先
│   │   ├── Weather/       walk-daily-advice(561) / walk-environment(330)
│   │   ├── Nearby/        lib/nearby/*(1,094)
│   │   ├── Articles/      article-feed-ranking(491)
│   │   ├── Calendar/      business-hours / walk-area-catalog
│   │   └── Vlog/          edl / duration / quality-gate
│   ├── Data/
│   │   ├── SupabaseClient      supabase-swift
│   │   ├── WanspotAPIClient    共通通信層 + slow path 4本の型付きAPI
│   │   └── Cache/              client-cache / geo-cache / spot-detail-cache 相当
│   └── Tests/                  ← パリティテスト
└── Wanspot/               ← アプリ本体（SwiftUI）
    ├── App/               エントリ / TabView / ルーティング
    ├── Features/          画面単位
    ├── DesignSystem/      LiquidGlass / AppHeader / PressableScale / 配色 / タイポ
    └── Platform/          Location / Notifications / Ads / Analytics / Photos
```

**状態管理**: `@Observable` + `@State` / `@Environment`。Feature ごとに `@Observable` Store を1つ置き、`WanspotKit` の関数を呼ぶ薄い層にする。

---

## 3. 技術対応表

iOS 26 が最低ラインなので、代替ライブラリ探しはほぼ不要。

### UI

| 現状 | Swift 版 |
|---|---|
| `expo-router`（45 ファイル） | `NavigationStack` + `TabView`、型付き `NavigationPath` |
| `expo-glass-effect` → `components/ui/LiquidGlass.tsx` | `.glassEffect()` / `GlassEffectContainer`（**iOS 26 ネイティブ。フォールバック不要**） |
| `expo-blur`（3） | `.background(.ultraThinMaterial)` |
| `react-native-reanimated`（13） | `withAnimation` / `PhaseAnimator` |
| `react-native-svg`（22） | Asset Catalog の SVG / SF Symbols / `Path` |
| `@shopify/react-native-skia`（1・`VlogLiquidGauge`） | `Canvas` + `ShaderLibrary` |
| `expo-image` | `AsyncImage`（遅ければ Nuke 検討） |
| `@expo/vector-icons` | SF Symbols |

### データ / プラットフォーム

| 現状 | Swift 版 |
|---|---|
| `@supabase/supabase-js` | **supabase-swift**（Auth / PostgREST / Storage / Realtime 全対応） |
| `AsyncStorage`（認証セッション） | Keychain（supabase-swift 既定）+ `UserDefaults` |
| `expo-constants` の `extra` | `.xcconfig` + `Info.plist`（`app.config.js` の env 解決を移植） |
| `expo-location`（8） | CoreLocation（バックグラウンド位置は**無効のまま**） |
| `expo-notifications`（3） | UserNotifications |
| `expo-apple-authentication` | `SignInWithAppleButton` |
| Google OAuth（`lib/oauth-supabase.ts`） | `ASWebAuthenticationSession` + supabase-swift（**PKCE 維持**） |
| `expo-image-picker`（2） | `PhotosPicker` |
| `expo-image-manipulator`（2） | Core Image / `UIGraphicsImageRenderer` |
| `expo-media-library`（2） | `PHPhotoLibrary` |
| `expo-video`（4） | `VideoPlayer`（AVKit） |
| `expo-sharing` | `ShareLink` |
| `expo-file-system` | `FileManager` |
| `expo-haptics`（3） | `.sensoryFeedback()` |
| `react-native-google-mobile-ads`（7） | Google Mobile Ads SDK for iOS（`UIViewRepresentable` で `GADNativeAdView` を包む） |
| Amplitude | Amplitude Swift SDK（**イベント名据え置き**） |

### 地図 — 人間に判断を仰ぐ論点

現状 `PROVIDER_GOOGLE` 明示で Google Maps 使用（`components/map/NearbyMapView.tsx:316`）。

- **MapKit for SwiftUI**（推奨）— SwiftUI 統合が自然、API キー不要、コスト0。地図の見た目は変わる。
- **Google Maps SDK for iOS** — 見た目は保てるが `UIViewRepresentable` 必須、キーのコスト継続。

スポットデータは Supabase / Wanspot API 持ちで、Google Places に**地図描画を依存していない**。乗り換えの実害は「タイルの見た目が変わる」だけ。
**Phase 4 冒頭で両方のプロトタイプを作り、スクリーンショットを添えて人間に判断を仰ぐこと。エージェント単独で決めない。**

---

## 4. パリティテスト — この移行の肝

`lib/` の純ロジックは、**本番で正しく動いている実行可能な仕様書**。捨てずに使う。

### 手順

1. TS 側に「入力 → 出力」を JSON で吐くスクリプトを書く（既存の `eval/` や `.review-dataset-100.json` と同じ発想）。出力先は `swift/WanspotKit/Tests/Fixtures/`。
2. Swift 実装が同じ入力に同じ出力を返すことをテストする。
3. **フィクスチャ生成スクリプトはリポジトリに残す。** 後から差分を再検証できるようにする。

### 最低限の対象

- 天気アドバイス生成 — `lib/weather/walk-daily-advice.ts`(561) / `walk-environment.ts`(330)
- 周辺スポットのソート・フィルタ — `lib/nearby/*`(1,094)
- 記事フィードのランキング — `lib/article-feed-ranking.ts`(491)
- 営業時間判定 — `lib/business-hours.ts`
- Vlog の EDL 生成 — `lib/vlog/edl.ts`

浮動小数の比較は許容誤差を明示すること。日付は JST 固定（`@holiday-jp/holiday_jp` を使っている箇所は祝日判定の移植先を先に決める）。

---

## 5. フェーズ

各フェーズは**完了条件を満たすまで次に進まない**。見積もりは1人フルタイム換算の目安。

### Phase 0 — 基盤（約1週）
- 新規 Xcode プロジェクト、iOS 26 ターゲット、`WanspotKit` パッケージ分離
- 初期開発は `app.wanspot.native.swift` で分離し、Phase 3 の内部 TestFlight
  開始時に本番 ID `app.wanspot.native` へ切り替える
- 依存追加: supabase-swift / Google Mobile Ads / Amplitude
- `.xcconfig` で `app.config.js` の env 解決を再現
- CI（Xcode Cloud か GitHub Actions）でビルド + テスト
- **完了条件**: 空のタブが3つ立ち上がり、CI が緑

### Phase 1 — ドメイン層（約2〜3週）★最初にやる
- `lib/` の純ロジックを `swift/WanspotKit/Domain` へ移植
- 同時にパリティテストのフィクスチャを生成しテストを書く
- UI を1行も書かずに、アプリの頭脳が移り、かつ検証済みになる
- **完了条件**: §4 の対象すべてでパリティテストが通る

### Phase 2 — データ層（約2週）
- supabase-swift で 9 テーブル + 3 Storage バケット。**RLS の前提を RN 版と突き合わせる**
- `WanspotAPIClient` に認証ヘッダー、12秒/40秒タイムアウト、エラー処理を集約。slow path 4本を型付き実装し、画面固有APIは該当 Feature Phase で DTO を追加
- キャッシュ層（`client-cache` / `geo-cache` / `spot-detail-cache` 相当）
- **完了条件**: テストから実データを取得しモデルにデコードできる

### Phase 3 — 認証 + オンボーディング（約2週）
- Sign in with Apple / Google OAuth / ゲスト継続（`lib/continue-as-guest.ts`）
- 現行の実動線を移植する。`dog` → `location` → 完了、位置情報拒否時のみ
  `area` → `ready`。`size` は旧ルートから `dog` へのリダイレクトで、
  サイズ入力自体は `dog` 内
- **完了条件**: 新規登録から `onboarding-complete` まで通る。**ここで TestFlight 内部配布を開始**
- 2026-08-19: 2.0.0 (253) を内部 TestFlight 用にアップロード

### Phase 4 — 検索 / 地図タブ（約3〜4週）★最難関
- `app/(tabs)/index.tsx`(860) + `components/map/NearbyMapView.tsx`(424) + `MapFilterBar` + `NearbySpotCarousel` + `WalkAlertModal`(377) + `NearbyListScreen`(694)
- **冒頭で地図の判断を人間に仰ぐ**（§3）
- `GlassTabBar` / `AppHeader` / `LiquidGlass` など DesignSystem の土台をここで固める
- **完了条件**: 主動線（開く → 近くのスポットが見える）が成立

### Phase 5 — スポット詳細（約2〜3週）
- `components/spot-detail/SpotDetailScreen.tsx`(1,728) — いいね / チェックイン / メモ / 共有 / AI サマリ
- 写真ギャラリーは **`photo_refs`（新 API）** を正とする。§8 を必ず読むこと
- **完了条件**: 地図・リスト・ディープリンクの全経路から詳細に入れる

### Phase 6 — カレンダー / まとめ記事（約3週）
- `CalendarTabScreen`(500) + `app/calendar/[slug].tsx`(362)
- `ArticlesTabScreen`(462) + `ArticleDetailScreen`(883)
- **完了条件**: 2タブが機能

### Phase 7 — アルバム / Vlog（約3〜4週）
- `components/album/ReviewAlbumTimeline.tsx`(2,260) — **単体最大**
- `AlbumMosaic`(331) / `DailyLogComposerModal`(368) / `VlogGeneratingPanel`(286) / `VlogUnlockPanel` / `VlogOneTapOffer`
- `VlogLiquidGauge`(350) の Skia → `Canvas` + Shader
- `app/vlog/preview.tsx`(361) と `expo-video` → `VideoPlayer`
- **レンダリングはサーバ側**。ここは UI と状態遷移だけの勝負
- **完了条件**: レビュー投稿 → Vlog 生成 → 保存・共有 まで通る

### Phase 8 — マイページ / 設定 / 広告 / 通知（約2〜3週）
- `app/(tabs)/mypage.tsx`(307) / `DogIdentityProfile`(1,131) / `app/likes.tsx`(322) / `app/checkins.tsx`(298) / `app/settings/*` / `account-delete`
- ネイティブ広告（`NativeAdStandardCard` / `ListAdSlot` / `lib/ads/list-injection.ts`）+ ATT
- ローカル通知3種（`memory-anniversary` / `walk-advice-morning` / deeplink）
- Amplitude イベントの網羅確認
- **完了条件**: 機能パリティ達成

### Phase 9 — 切り替え（約2週）
- 実機通しテスト / パフォーマンス計測 / 審査対応（ATT・権限文言・`PrivacyInfo.xcprivacy`）
- TestFlight で育てた `app.wanspot.native` の 2.0.0 を最終ビルドへ更新して提出
- 段階リリース 1% → 100%、RN 版リポジトリをアーカイブ

**合計 5〜6ヶ月。** Phase 4・5・7 で全体の半分近く。

---

## 6. 今すぐ着手する手順

1. `react-native-map-clustering` と `expo-auth-session` を `package.json` から削除
   （どこからも import されていない死んだ依存。移行前の掃除）
2. Xcode で新規プロジェクト `Wanspot` を作成（iOS 26 / SwiftUI / Bundle ID `app.wanspot.native.swift`）
3. `WanspotKit` を Swift Package として切り出す
4. supabase-swift を追加し、**`users` テーブルを1件読むだけのテストを通す**
   → ここが通れば移行の技術的な不確実性は8割消える
5. Phase 1 の1本目に `lib/business-hours.ts` を選ぶ
   小さく・純粋で・パリティテストの型を作るのにちょうどいい

---

## 7. 人間に確認すること / 独断で進めてよいこと

**必ず確認する**

- 地図を MapKit にするか Google Maps を維持するか（Phase 4 冒頭・プロトタイプ添付）
- iOS 26 未満のユーザーへの対応方針（Phase 9 前に App Store Connect の OS 分布を確認）
- Supabase スキーマや API に変更が必要だと判断した場合（**原則として変更しない**）
- RN 版に手を入れる必要が出た場合（§1 の死んだ依存の削除を除く）

**独断で進めてよい**

- `WanspotKit` 内のファイル分割・命名・型設計
- SwiftUI の View 分割粒度
- テストの書き方、フィクスチャの形式
- Phase 内のタスク順序

**判断に迷ったら**: Phase の完了条件に照らして、それに近づくかどうかで決める。近づかない作業はやらない。

---

## 8. 写真ギャラリーと `photo_refs`（Phase 5・必読）

API が写真参照の配列 `photo_refs` を返すようになった。Swift 版はこれを正とする。

### RN 版の現状（そのまま移植してはいけない）

`SpotDetailScreen.tsx` には **すでに最大8枚のギャラリーがある**。ただしデータ源が違う。

| 箇所 | 内容 |
|---|---|
| `SpotDetailScreen.tsx:222` | `photoRefs: string[]` を state で保持 |
| `SpotDetailScreen.tsx:411` | `detailRes.photos.slice(0, 8).map(p => p.photo_reference)` から充填（**`photos[]` 経由。`photo_refs` ではない**） |
| `SpotDetailScreen.tsx:906` | `spotPhotoUrl(ref, 'hero')` で URL 化 |
| `SpotDetailScreen.tsx:938-961` | 横 `FlatList` + `pagingEnabled` + `N / M` バッジ |

単数の `photo_ref` を読んでいるのは**一覧・カード系だけ**で、そこは元々1枚表示。ギャラリー化の対象ではない。
（`SpotListCard.tsx:106` / `NearbySpotCard.tsx:110` / `NearbySheetSpotCard.tsx:97` / `ArticleDetailScreen.tsx:224,551` ほか）

### 移植してはいけない実装 — 先読みによる課金増

`SpotDetailScreen.tsx:527-534` に以下がある。

```ts
useEffect(() => {
  if (photoRefs.length === 0) return
  const urls = photoRefs
    .map((r) => spotPhotoUrl(r, 'hero'))   // hero = 1600px
    .filter((u): u is string => u != null && u.length > 0)
  if (urls.length === 0) return
  void Image.prefetch(urls, 'memory-disk')  // ← 全枚数を即時ネットワーク取得
}, [photoRefs])
```

`FlatList` 側は `initialNumToRender={2}` / `maxToRenderPerBatch={2}` / `windowSize={3}` /
`removeClippedSubviews` で**描画は遅延している**が、この `prefetch` が全枚数を最大解像度で
先に取りにいくため、遅延の意味が打ち消されている。スポット詳細を1回開くだけで最大 **8枚分**の
写真取得が走る。

### Swift 版の要件

- **1枚目だけ即時取得。** 2枚目以降は遅延。
- 先読みするなら**現在表示中の前後1枚まで**。全枚数の一括先読みは禁止。
- ヒーロー解像度(1600px)の一括先読みは特に禁止。サムネ用途は小さいサイズを使う。
- 枚数上限は現状踏襲で 8 枚。

`TabView(.page)` か `ScrollView(.horizontal)` + `.scrollTargetBehavior(.paging)` で組み、
`.task(id:)` で表示中インデックスの前後だけを取得する形にする。

### 人間に確認すべきこと（未確定・推測で実装しない）

1. `photo_refs` はどのエンドポイントのどの階層に入るか（`/api/spots/detail` の直下か、spots 行か、一覧系にも載るか）
2. 既存の `photos[].photo_reference` を**置き換える**のか、**併存**するのか
3. 配列の順序に意味があるか（1枚目 = 代表写真か）
4. `/api/spots/photo?ref=...` プロキシはサーバ側でキャッシュするか
   → 「初回だけ課金が N 倍」という前提が成り立つかがこれで決まる。**最優先で確認する**
