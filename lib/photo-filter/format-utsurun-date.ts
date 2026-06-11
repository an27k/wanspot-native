/** 写ルンです風日付スタンプ: '26 6 5（年下2桁・月日はゼロ埋めなし） */
export function formatUtsurunDate(d: Date = new Date()): string {
  const yy = String(d.getFullYear()).slice(-2)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${yy} ${m} ${day}`
}
