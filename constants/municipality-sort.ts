const TOKYO23_ORDER = [
  '千代田区',
  '中央区',
  '港区',
  '新宿区',
  '文京区',
  '台東区',
  '墨田区',
  '江東区',
  '品川区',
  '目黒区',
  '大田区',
  '世田谷区',
  '渋谷区',
  '中野区',
  '杉並区',
  '豊島区',
  '北区',
  '荒川区',
  '板橋区',
  '練馬区',
  '足立区',
  '葛飾区',
  '江戸川区',
] as const

function getSortKey(name: string): number {
  const tokyo23Idx = (TOKYO23_ORDER as readonly string[]).indexOf(name)
  if (tokyo23Idx >= 0) return 1000 + tokyo23Idx

  if (/市.+区$/.test(name)) return 2000
  if (name.endsWith('市')) return 3000
  if (name.endsWith('町')) return 4000
  if (name.endsWith('村')) return 5000
  return 6000
}

/** 単一都道府県内の市区町村名を優先ルール付きでソート（座標データは変更しない） */
export function sortMunicipalityNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const keyA = getSortKey(a)
    const keyB = getSortKey(b)
    if (keyA !== keyB) return keyA - keyB
    return a.localeCompare(b, 'ja')
  })
}
