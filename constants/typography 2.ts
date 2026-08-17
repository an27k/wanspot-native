import type { TextStyle } from 'react-native'

/**
 * 文字の型。
 *
 * 導入前の実測（components/ と app/ の全スタイル）:
 *   文字サイズ 19種類が混在（8〜29px）。276回が 11〜14px に集中
 *   ウェイト   800が125回・700が112回・900が50回。400はわずか2回
 *
 * 全部が小さくて全部が太い状態だった。太字しかない画面では何も強調されない。
 * これが「メリハリが無い」の正体で、色ではなく型の問題だった。
 *
 * カスタムフォントは読み込まない。iOS では既に SF Pro ＋ ヒラギノ角ゴが、
 * Android では Roboto ＋ Noto Sans JP が既定で当たる。ネイティブらしさは
 * 字体を足して出すものではなく、使い方を決めて出すもの。
 *
 * **ここに無いサイズ・ウェイトは使わないこと。** 例外を作った瞬間に元に戻る。
 */
export const type = {
  /** 画面のラージタイトル。設定・いいね・行った */
  largeTitle: { fontSize: 34, fontWeight: '800', letterSpacing: -0.7, lineHeight: 40 },
  /**
   * スポット名・シートの見出し・ヒーローカードの見出し。
   * ハンドオフのシート見出し(26)に合わせている。22 にすると現状の 20 から
   * ほぼ変わらず、階層を作る役に立たない
   */
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 33 },
  /** 画面内のセクション見出し */
  heading: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  /** リスト行。iOS の標準はウェイト400で、ここを太くすると一覧が読めなくなる */
  row: { fontSize: 17, fontWeight: '400', lineHeight: 23 },
  /** ボタン。行と同じサイズで太さだけ上げる */
  button: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  /**
   * 読ませる本文。AIレビュー・お散歩アドバイス。
   * ハンドオフの指定は14pxだが、あちらは英数字中心の想定。
   * wanspot の本文は日本語で、同じサイズでも漢字は小さく見えるので16pxを下限にする。
   */
  body: { fontSize: 16, fontWeight: '400', lineHeight: 25 },
  /** 補足・メタ情報 */
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 19 },
  /** マイクロラベル。セクションの上に置く小見出し */
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, lineHeight: 16 },
} satisfies Record<string, TextStyle>

export type TypeToken = keyof typeof type
