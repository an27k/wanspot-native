/**
 * フローティングタブバー本体の高さ（セーフエリア・画面端の隙間は含まない）。
 */
export const TAB_BAR_PILL_HEIGHT = 56

/** タブバーを画面端から浮かせる隙間。下部余白の計算に足す。 */
export const TAB_BAR_FLOAT_GAP = 10

/**
 * タブ画面の下部余白計算用（セーフエリア除く）。
 * フローティング化したタブバーの本体＋隙間。
 */
export const TAB_BAR_HEIGHT = TAB_BAR_PILL_HEIGHT + TAB_BAR_FLOAT_GAP
