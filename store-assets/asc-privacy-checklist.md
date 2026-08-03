# App Privacy（nutrition label）修正チェックリスト

App Store Connect APIキーが無いため手動更新用。
APIの `appDataUsages` は書き込み可能なエンドポイントが存在するが、キー無しでは実行不可。

## 前提: このビルドに広告SDKは含まれていない

当初「広告データ・デバイスIDは AdMob があるので現状維持」と判断したが、**これは誤りだった**。
実際には広告は完全に無効で、SDK がバイナリに入っていない。

根拠（2026-08-03 コード確認）:

| 確認項目 | 結果 |
|---|---|
| `constants/ads.ts` の `ADS_ENABLED` | 環境変数 `EXPO_PUBLIC_ADS_ENABLED` 未設定 → **false** |
| `.env.example` / `.env.local` / `eas.json` | `.env.example` に `false`、他は未設定 |
| `app.config.js` | `adsEnabled` が false のとき `react-native-google-mobile-ads` プラグインを **plugins から除外** |
| `ios/Podfile.lock` の `Google-Mobile-Ads-SDK` | **0件**（SDK がバイナリに入らない） |
| `ios/wanspotnative/Info.plist` の `GADApplicationIdentifier` | **0件** |
| `lib/prepare-search-ads.ts` の ATT 要求 | `adsEnabledForDevice()` でガード → **ダイアログは出ない** |
| `lib/analytics.ts` の `track()` | `console.log` のみの stub（解析SDKへの送信なし） |
| `expo-contacts` | 未使用 |
| `/api/search/history` | アプリからの呼び出し **0件**（検索履歴は送っていない） |

→ **トラッキングは一切行っていない。**「トラッキングに使用されるデータ」欄は空にすること。
ATT を実装していない（＝ダイアログを出さない）のにトラッキングと申告すると **5.1.2 の指摘対象**になる。

## 実際に収集しているもの

すべて自社サーバー（Supabase）に保存。**第三者提供なし**。

| データ種別 | 実装上の根拠 | 申告する目的 |
|---|---|---|
| メールアドレス | Supabase Auth | アプリの機能 |
| ユーザID | Supabase Auth | アプリの機能 / 製品のパーソナライズ |
| 詳細な位置情報 | 近くのスポット検索・お散歩アラートの気温取得 | アプリの機能 / 製品のパーソナライズ |
| 写真またはビデオ | 愛犬の写真（avatars バケット） | アプリの機能 |
| 製品の操作 | `lib/user-events.ts`（app_open / map_view / area_search / spot_view / like） | アナリティクス |

※「名前」は飼い主の氏名ではなく**愛犬の名前**。Apple/Google サインインで氏名が渡る場合があるため、
　残すか外すかは実データ（`users` テーブル）を見て判断すること。

## 収集していない（申告から外す）

| データ種別 | 理由 |
|---|---|
| **広告データ** | 広告SDKがバイナリに無い |
| **デバイスID** | 同上（IDFA/IDFV を取得する経路が無い） |
| **クラッシュデータ** | Sentry 等の解析SDK未導入（Apple 標準のクラッシュレポートは開発者の申告対象外） |
| **パフォーマンスデータ** | 同上 |
| **その他の診断データ** | 同上 |
| **検索履歴** | 該当APIをアプリから呼んでいない |

## 作業手順

App Store Connect → アプリ → Appのプライバシー → 編集

1. 「トラッキング目的に使用」のチェックを**全データ種別で外す**
2. 上の「収集していない」6種別を削除
3. 残す5種別の目的を、上表のとおりに絞る（広告/マーケティング系の目的を外す）

完了後、「ユーザのトラッキングに使用されるデータ」欄が**空**になっていることを確認する。

## 将来 広告を有効化するとき

`EXPO_PUBLIC_ADS_ENABLED=true` にすると AdMob ネイティブ広告（まとめ記事一覧に5件ごと1枠）が
復活し、ATT ダイアログも出るようになる。そのときは広告データ・デバイスID・トラッキングを
申告に戻すこと。プライバシーポリシー本文（wanspot リポジトリ `src/app/privacy/page.tsx`）の
更新も必要。

## 年齢制限（ソーシャルメディア新設問）

現状のアプリには他ユーザーとの交流（フォロー/コメント/投稿フィード）もアルバム/VLOGも無い
（`REVIEW_ALBUM_TAB_ENABLED=false`, `VLOG_ENABLED=false`）。
VLOG の「SNSで共有」は OS の共有シート経由の書き出しのみで、アプリ内交流ではない。
バナーの設問文を読んで、該当しなければ「該当しない」系を選択。
設問文は本セッションでは未確認 → 手動で確認すること。
