# wanspot-native

wanspot の iOS / Android アプリ（Expo SDK 55 / React Native 0.83）。

## Android ローカルビルド（android-port ブランチ）

ローカルで Android ビルドを起動するための手順。ストア提出・署名・本番 ID はスコープ外（下記 TODO 参照）。

### 前提

- JDK 17（例: `brew install openjdk@17`）
- Android SDK（Android Studio または `brew install --cask android-commandlinetools`）
  - `platform-tools` / `platforms;android-36` / `build-tools;36.0.0` / `emulator` / arm64 システムイメージ
- 環境変数: `ANDROID_HOME=$HOME/Library/Android/sdk`、`JAVA_HOME`（JDK 17）

### ビルド・起動

```bash
npm install
npx expo prebuild --platform android   # android/ を生成（gitignore 済み）
npx expo run:android                   # エミュレータ or USB 接続実機で起動
```

### JS エンジン

- iOS: `app.json` トップレベルの `"jsEngine": "jsc"`（iOS 26 + Hermes の console クラッシュ回避のため）
- Android: `app.json` → `android.jsEngine: "hermes"` で上書き。RN 0.79+ は JSC が本体から削除されており、Android で JSC を使うには別パッケージが必要なため Hermes を使用。**iOS 側の jsc 設定には影響しない**

### Google Maps API キー（Android）

- 差し込み箇所: `app.json` → `expo.android.config.googleMaps.apiKey`
- 現在は iOS と同じキーを暫定設定。**地図が灰色/空白になる場合**は、Google Cloud Console でこのキーに「Maps SDK for Android」を有効化するか、Android 用に制限した別キーを発行して差し替えること（v96 で `react-native-maps` を使うため Android ネイティブキーが必須）
- AI プランのルート地図（静的画像）は別途 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`（Static Maps API、HTTP キー）を使用

### AdMob

- App ID（Android）: `app.json` → プラグイン `react-native-google-mobile-ads` の `androidAppId`
  - 現在は **Google 公式テスト App ID**（`ca-app-pub-3940256099942544~3347511713`）。リリース時に AdMob コンソールの本番 Android App ID へ差し替える
- 広告ユニット ID: `lib/ads/adUnitIds.ts` が解決。`__DEV__`（`run:android` のデバッグビルド）では常に Google の TestIds を使用
  - 本番ユニットは `.env` の `EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_AD_UNIT_ID` / `EXPO_PUBLIC_ADMOB_ANDROID_VIDEO_NATIVE_AD_UNIT_ID` に設定（現在はテストユニット ID）

### 認証（Android の差分）

- Apple Sign In: `lib/apple-signin.ts` の `isAppleSignInAvailable()` が Android で常に `false` を返すため、ボタンは表示されない
- Google Sign-In: `lib/google-signin.ts` が iOS 専用実装（`webClientId` 未構成）のため、Android ではログイン/新規登録画面のボタンを非表示（`Platform.OS === 'android'` ゲート）。Android 対応するには Google Cloud で Web クライアント ID を `GoogleSignin.configure({ webClientId })` に設定し、Supabase の Google プロバイダ許可クライアントに追加する
- Android でのログインは現状メール + パスワードを使用

### パーミッション

`android.permissions` は手動指定せず、各 config plugin が必要分のみ追加する:

- `expo-location` → ACCESS_FINE/COARSE_LOCATION
- `expo-image-picker` → CAMERA / メディア読み取り
- `react-native-google-mobile-ads` → AD_ID

### 残課題（TODO）

- [ ] 本番 AdMob Android App ID / ユニット ID への差し替え（上記参照）
- [ ] Maps SDK for Android の本番キー発行 + `ANDROID_MAPS_API_KEY` 差し替え（ネイティブ地図導入時に必須）
- [ ] Google Sign-In の Android 対応（webClientId + Supabase 設定）
- [ ] リリース署名（keystore）と `versionCode` 運用
- [ ] Play Console 提出物（ストア掲載情報・データセーフティ）
