import { TOKENS } from '@/constants/color-tokens'
import type { AiPlanStop } from '@/components/ai-plan/types'

export const CATEGORY_LABELS: Record<string, string> = {
  park: '公園',
  dog_run: 'ドッグラン',
  cafe: 'カフェ',
  restaurant: 'レストラン',
  shopping_mall: 'ショッピング',
  shinto_shrine: '神社仏閣',
  buddhist_temple: '神社仏閣',
  tourist_attraction: '観光地',
  amusement_park: 'アミューズメント',
  museum: '博物館',
  spa: '温泉',
  onsen: '温泉',
  bakery: 'ベーカリー',
  store: 'ショップ',
  food: '飲食',
  zoo: '動物園',
}

export function getCategoryLabel(stop: AiPlanStop): string {
  const ext = stop.extended_category
  if (ext && CATEGORY_LABELS[ext]) {
    return CATEGORY_LABELS[ext]
  }
  const types = stop.google_types
  if (Array.isArray(types)) {
    for (const type of types) {
      if (typeof type === 'string' && CATEGORY_LABELS[type]) {
        return CATEGORY_LABELS[type]
      }
    }
  }
  const cat = stop.category
  if (typeof cat === 'string' && cat.trim()) {
    return cat
  }
  return 'スポット'
}

export function getCategoryBgColor(stop: AiPlanStop): string {
  const label = getCategoryLabel(stop)
  const greenish = ['公園', 'ドッグラン', '観光地', '神社仏閣']
  const beige = ['カフェ', 'レストラン', 'ベーカリー', '温泉', '飲食']
  const purple = ['ショッピング', 'ショップ', 'アミューズメント', '博物館', '動物園']
  if (greenish.includes(label)) return TOKENS.category.park
  if (beige.includes(label)) return TOKENS.category.food
  if (purple.includes(label)) return TOKENS.category.retail
  return TOKENS.category.fallback
}
