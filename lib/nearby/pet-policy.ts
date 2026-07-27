/**
 * ペット同伴可否の共通述語・共通文言。
 *
 * 「店内わんこOK」フィルタの母集団は pet_indoor_allowed === true（確認済み）のみで、
 * unknown（null/undefined）は絶対に含めない — 現地で入れなかった、という体験を
 * うちの子と一緒に味わわせないための厳格運用。
 * 地図・検索タブ・スポット詳細の3面でこのモジュールだけを真実として共有する。
 */

/** ペット可否フィールド（共通コントラクト名）を持ちうるスポット */
export type PetPolicySource = {
  pet_indoor_allowed?: boolean | null
  pet_terrace_only?: boolean | null
  pet_friendly_status?: string | null
  pet_friendly_verified?: boolean | null
}

/** 「店内OK」フィルタの表示語（地図・検索タブで共通）。
 *  ラベルは短く保ち、「確認済みのみ」であることはスポット詳細バッジと空状態文言で担保する */
export const INDOOR_OK_FILTER_LABEL = '店内OK'

/** 「テラスOK」フィルタの表示語 */
export const TERRACE_OK_FILTER_LABEL = 'テラスOK'

/** 確認済みで店内OKのスポットか（unknown は必ず false） */
export function placeIsIndoorPetOk(p: PetPolicySource): boolean {
  return p.pet_indoor_allowed === true
}

/** テラス席で同伴できる確認があるスポットか（テラスのみ可 or 屋外のみ可の確認済み。unknown は false） */
export function placeIsTerracePetOk(p: PetPolicySource): boolean {
  return p.pet_terrace_only === true || p.pet_friendly_status === 'outdoor_only'
}

/** スポット詳細の同伴可否バッジ。tone は表示色の使い分け用 */
export type PetPolicyBadge = {
  label: string
  tone: 'ok' | 'terrace' | 'caution'
}

/** 同伴可否バッジの内容を決める。根拠になるデータが無いときは null（何も出さない） */
export function petPolicyBadge(p: PetPolicySource): PetPolicyBadge | null {
  if (p.pet_indoor_allowed === true) return { label: '店内OK・確認済み', tone: 'ok' }
  if (p.pet_terrace_only === true) return { label: 'テラス席のみOK', tone: 'terrace' }
  if (p.pet_friendly_status === 'not_allowed') return { label: '同伴不可の可能性', tone: 'caution' }
  return null
}
