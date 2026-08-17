/**
 * 犬の名前を呼びかけの形にする。
 *
 * 名前をそのまま「◯◯ちゃん」に埋めると、未登録時のフォールバック（うちの子）が
 * 「うちの子ちゃん」になってしまう。名前がある場合だけ「ちゃん」を付ける。
 *
 * 通知本文にも同じ規則があるが（lib/weather/walk-daily-advice.ts の dogSubject）、
 * あちらはフォールバックが「ワンちゃん」で文体が違うため、統合していない。
 */
export function dogLabel(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed ? `${trimmed}ちゃん` : 'うちの子'
}
