# 2.1.0 プロモーション文章 と 審査メモ

---

## A. プロモーションテキスト（上限170字・ビルド無しで差し替え可）

### 案1（91字）— おすすめ。ユーザーの言葉から始める

```
「このお店、うちの子と入れる？」その場でワンスポAIに聞けます。確認できた情報だけでお答えし、わからないことは正直に。犬同伴OKのお店・公園・イベントを、愛犬に合わせてご案内します。
```

### 案2（82字）— 落ち着いたトーン

```
犬と行けるか迷ったら、ワンスポAIに聞いてみてください。確認できた情報をもとに、愛犬のサイズやいつものエリアに合わせてご案内。わからないことは、正直にお伝えします。
```

### 案3（72字）— 新機能であることを前に出す

```
ワンスポAIが仲間入り。「テラス席のあるカフェは？」「うちの子と入れる？」——おでかけの相談相手ができました。確認できた情報だけでお答えします。
```

いずれも「確認できた情報だけ／わからないことは正直に」を残しています。犬連れ可否は外すと現地で断られる情報なので、
そこを売りにしている点がこのアプリの差別化になります。

---

## B. App Review Information → Notes（英語・そのまま貼れます）

```
WHAT'S NEW IN THIS VERSION

This update adds "Wanspot AI," an in-app assistant that helps dog owners work out
where they can actually go with their dog.

HOW THE ASSISTANT WORKS

- It answers from our own database of dog-friendly venues, articles and events.
  It queries our data first, and only falls back to a constrained web search when
  our data has no answer.
- Every answer states the type of source it relied on (official site, listing site,
  user reviews, or web search). Unverified information is explicitly labelled and
  the user is told to confirm with the venue before visiting.
- When we have no information, the assistant says so instead of guessing. This is
  deliberate: getting dog-policy answers wrong means an owner is turned away at the door.

PRIVACY

- Conversations are stored per user so the user can resume a chat, and in aggregate
  to improve answer quality.
- A conversation is visible only to the user who created it. Nothing a user types is
  ever shown to any other user, so this is not publicly visible user-generated content.
- Conversations are deleted when the account is deleted.
- Disclosed in our privacy policy, section 2.3 ("Usage logs"), and declared in App
  Privacy as "Other User Content" (App Functionality, Analytics, Product
  Personalization; linked to the user; not used for tracking).

PERMISSIONS AND SDKs IN THIS BUILD

- The app requests only two permissions: Camera and Location When In Use. Both are
  used by features the reviewer can reach.
- This build contains no advertising SDK and does not request App Tracking
  Transparency permission. (A previous version was rejected under Guideline 2.1 for
  declaring a tracking permission it never used; that declaration and the ad SDK have
  both been removed.)

HOW TO REACH THE ASSISTANT

1. Sign in with the demo account below.
2. Tap the round character button at the bottom-right of any screen.
3. Try a suggested question chip, or ask something like
   "Can I bring my dog inside?" / "Any dog-friendly cafes near here?"

The assistant requires sign-in and is not shown to signed-out users.

DEMO ACCOUNT
  Email:    [ここにデモアカウントのメールアドレス]
  Password: [ここにパスワード]

Thank you for reviewing.
```

### 貼る前に

- **デモアカウント欄を実際の値に置き換える**（未記入のまま提出すると審査が止まります）
- チャットはログイン必須なので、そのアカウントで実際にチャットが開けるか一度確認してください

---

## C. なぜ審査メモにここまで書くか

3点だけ、審査で引っかかりやすい論点に先回りしています。

1. **UGC（ガイドライン1.2）** — 会話は本人にしか見えず、他のユーザーに配信されません。
   これを書いておかないと「ユーザー生成コンテンツの通報・ブロック機能は？」と聞かれます。
2. **AIの回答の正確性** — 出典の種類を示し、未確認情報にはラベルを付ける設計だと明示します。
3. **Guideline 2.1 の再発防止** — 過去に「宣言だけで使わない権限」で差し戻されているので、
   広告SDKもATTも入っていないことを先に書きます（実際にコードで確認済み）。
