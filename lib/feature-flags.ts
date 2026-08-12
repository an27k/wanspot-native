/**
 * レビュー / Vlog / AI 系の一時非表示用フラグ（独立トグル）。
 *
 * 復旧の目安（崩れにくい順）:
 * 1. SPOT_INLINE_REVIEW_ENABLED — スポット詳細の★/メモ（タブなしでも使える）
 * 2. REVIEW_ALBUM_TAB_ENABLED — カメラタブ・アルバム・visit シート・思い出通知の camera 導線
 * 3. VLOG_ENABLED — Vlog プレビュー・残りスポット表示・通知本文の Vlog 文言
 *
 * ─────────────────────────────────────────────────────────────
 * **フラグを true にする前に、ネイティブ側の設定を戻すこと。**
 *
 * 2026-08-12 の審査（Guideline 2.1）で「宣言だけあって使わない権限」を指摘されたため、
 * 止まっている機能が要求する権限とモジュールをバイナリから外した。
 * コードは残してあるので、フラグを立てるだけでは**起動時に落ちる**か、
 * 保存・撮影の瞬間に **iOS がアプリを強制終了させる**。
 *
 * | 立てるフラグ | 戻すもの |
 * |---|---|
 * | REVIEW_ALBUM_TAB_ENABLED | app.json の expo-image-picker から `microphonePermission: false` を削除（動画撮影に録音権限が要る） |
 * | VLOG_ENABLED | app.json の plugins に `expo-media-library` を戻す ＋ package.json の autolinking.exclude から外す（カメラロール保存） |
 *
 * どちらも Info.plist は prebuild で再生成されるので、手で書き足さないこと。
 * ─────────────────────────────────────────────────────────────
 */

/** カメラ（レビューアルバム）タブ、AlbumSection、思い出通知の /(tabs)/camera 導線、行った後 visit シート（★とメモをのこす → カメラ） */
export const REVIEW_ALBUM_TAB_ENABLED = false

/** Vlog プレビュー画面、visit シートの「Vlogまで あとNスポット」、思い出通知本文の Vlog 案内文言 */
export const VLOG_ENABLED = false

/** スポット詳細のインライン「わんこの評価」（★＋メモ）UI と保存。タブ非表示中も true 推奨 */
export const SPOT_INLINE_REVIEW_ENABLED = true
