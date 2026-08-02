---
name: ios-release
description: wanspot の iOS ビルド・リリース手順。ビルド番号の更新、リリース前の検証、コミットと push の判断を扱う。「ビルド準備」「ビルドして」「ビルド番号を上げて」「TestFlight」「リリース」「Archive」と言われたときは必ずこのスキルを使うこと。ネイティブ側のコミットや、サーバ（wanspot リポジトリ）を本番反映する push の可否を判断するときにも参照する。
---

# wanspot iOS リリース手順

このプロジェクトは**アプリ（wanspot-native）とサーバ（wanspot）の2リポジトリ**で動く。
アプリは Bearer JWT でサーバの `/api/*` を叩く。サーバへの push は Vercel の自動デプロイで
**即座に本番へ反映される**ため、アプリのビルドとは危険度が違う。ここを混同しないこと。

## ビルド番号を上げる

**3ファイル4箇所を必ず同時に更新する。** ズレると Archive / EAS で番号が食い違い、
アップロードが弾かれる。

| ファイル | キー | 箇所数 |
|---|---|---|
| `app.json` | `expo.ios.buildNumber` | 1 |
| `ios/wanspotnative/Info.plist` | `CFBundleVersion` | 1 |
| `ios/wanspotnative.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION` | **2**（Debug と Release） |

```bash
NEW=217; OLD=216
sed -i '' "s/\"buildNumber\": \"$OLD\"/\"buildNumber\": \"$NEW\"/" app.json
sed -i '' "s|<string>$OLD</string>|<string>$NEW</string>|" ios/wanspotnative/Info.plist
sed -i '' "s/CURRENT_PROJECT_VERSION = $OLD;/CURRENT_PROJECT_VERSION = $NEW;/g" ios/wanspotnative.xcodeproj/project.pbxproj
```

更新後は必ず4箇所すべてを目視確認する。`pbxproj` は2箇所あるので `-u` で1つだけ出たら失敗。

### 番号を決める前に確認すること

**リポジトリの番号と、実際に TestFlight にある最新番号は食い違うことがある。**
Archive 時に Xcode が `CFBundleVersion` を自動インクリメントし、後からリポジトリを
追従させる運用のため、リポジトリ側だけを見て決めると重複してアップロードが弾かれる。

- 履歴に `Export後の実ビルド番号NNNに揃える` というコミットがあれば、その番号は**使用済み**
- 番号を上げる前に、実際の最新番号をユーザーに確認する
- 迷ったら飛ばす方が安全。番号を飛ばしても害はないが、重複は必ず失敗する

`ios/` は `.gitignore` 対象だが `pbxproj` と `Info.plist` は追跡済みなので、
`git add` の ignore 警告は無視してよい（コミットには入る）。

## リリース前の検証

ビルドが通らないコードを本番に出さないための最低限。**型が通ることと動くことは別**なので、
バンドルとネイティブビルドまで確かめる。

```bash
npx tsc --noEmit                      # 0 エラーであること
npx eslint app components lib constants hooks context   # error 0（warning は許容）
npx expo export --platform ios --output-dir /tmp/exp    # import エラーを検出
```

`tsc` を通っても `expo export` で落ちることがある。型では追えない実行時の import 解決や、
削除したモジュールへの参照はここで初めて出る。

**依存を変更した場合は追加で必要**（`package.json` を触ったとき）:

```bash
npm install
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```

`pod install` は locale 未指定だと `Unicode Normalization not appropriate for ASCII-8BIT`
で落ちる。UTF-8 を明示すること。

**確実にしたいときはネイティブビルドまで通す**（10分前後かかる）:

```bash
xcodebuild -workspace ios/wanspotnative.xcworkspace -scheme wanspotnative \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/build CODE_SIGNING_ALLOWED=NO build 2>&1 | grep -E "error:|BUILD (SUCCEEDED|FAILED)"
```

### コミット済みコードが壊れていないか

作業ツリーで `tsc` が通っても、**コミット済みの状態が壊れていることがある**。
片方のファイルだけコミットして相方を忘れると起きる。実際に、prop を使う側だけが
コミットされ、prop を定義した側が未コミットで、クリーンチェックアウトが型エラーになっていた。

疑わしいときは:

```bash
git stash && npx tsc --noEmit; git stash pop
```

## コミット規約

日本語 + conventional prefix + **句点で終える**。本文で「なぜ」を書く。

```
feat(search): 検索の並び順を飼い主の失望の大きさ順に再設計する。

旧実装は 1km の距離バケットが最優先で、飼い主の失望の構造と真逆だった。
「未検証で同伴可否も分からない店」が近いというだけで検証済みの店より上に出ており、
これが「所詮AI」という失望の主因になっていた。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

- **関心事ごとに分ける**。`feat` / `fix` / `chore(ios)` を1コミットに混ぜない
- ビルド番号更新は `chore(ios): TestFlightビルド番号をNNNに更新する。` 単独で
- 本文には**測定した数値や実際に踏んだ症状**を書く。「改善した」ではなく「4.6%→100%」

## push の判断

**アプリ（wanspot-native）**: ローカルコミットのままにする。push はユーザーの指示があるまでしない。

**サーバ（wanspot）**: push すると Vercel が自動デプロイし**即座に本番反映**される。
必ず指示を得てから push する。

push は remote URL に古い無効トークンが埋まっているため、以下の形で行う。
**remote URL の書き換えや生トークンの取り扱いはしない**。

```bash
git -c credential.helper= \
  -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $(echo -n "x-access-token:$(gh auth token)" | base64)" \
  push origin main
```

push 後は本番の疎通を確認する。削除した API は 405/404、現役の API は 200 になるはず。

## 環境変数を調べるときの落とし穴

`vercel env pull` は **Sensitive 変数の値を返さない**。空に見えても設定済みのことがある。
「ローカルで空だから未設定」と断定して、動いている機能を壊れていると誤診しないこと。
判断するなら `vercel env ls` でメタ情報を見るか、実際の挙動（ログ・DBに残った痕跡）で確かめる。

## 報告するとき

- 検証していないことを「確認済み」と書かない。ネイティブビルドを回していないなら、そう言う
- 実機確認ができていない範囲は明示する。ログイン後の画面は認証情報を入力しないため確認できない
- ビルドに含まれる変更と、含まれない変更（未ビルドのコミット）を区別して伝える
