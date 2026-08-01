/**
 * レビュー / Vlog / AI 系の一時非表示用フラグ（独立トグル）。
 *
 * 復旧の目安（崩れにくい順）:
 * 1. SPOT_INLINE_REVIEW_ENABLED — スポット詳細の★/メモ（タブなしでも使える）
 * 2. REVIEW_ALBUM_TAB_ENABLED — カメラタブ・アルバム・visit シート・思い出通知の camera 導線
 * 3. VLOG_ENABLED — Vlog プレビュー・残りスポット表示・通知本文の Vlog 文言
 */

/** カメラ（レビューアルバム）タブ、AlbumSection、思い出通知の /(tabs)/camera 導線、行った後 visit シート（★とメモをのこす → カメラ） */
export const REVIEW_ALBUM_TAB_ENABLED = false

/** Vlog プレビュー画面、visit シートの「Vlogまで あとNスポット」、思い出通知本文の Vlog 案内文言 */
export const VLOG_ENABLED = false

/** スポット詳細のインライン「わんこの評価」（★＋メモ）UI と保存。タブ非表示中も true 推奨 */
export const SPOT_INLINE_REVIEW_ENABLED = true
