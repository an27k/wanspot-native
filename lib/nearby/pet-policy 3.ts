/**
 * ペット同伴可否の共通述語・共通文言。
 *
 * 「店内OK」「テラスOK」フィルタの母集団は確認済みフラグのみ。
 * unknown（null/undefined）は絶対に含めない — 現地で入れなかった、という体験を
 * うちの子と一緒に味わわせないための厳格運用。
 * 地図・検索タブ・スポット詳細の3面でこのモジュールだけを真実として共有する。
 *
 * 判定の真実源（優先順）:
 * 1. pet_indoor_allowed / pet_terrace_only（検証バッチが status と整合させて書く）
 * 2. pet_friendly_status の決定的な値（outdoor_only / not_allowed）
 *
 * 店内OK = 店内（屋内席）への同伴が確認済み
 * テラスOK = テラス席・屋外席での同伴が確認済み（店内不可・外席のみを含む）
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
  // 明示 true のみ。status=allowed でも indoor 未確認（null）は通さない
  if (p.pet_indoor_allowed === true) return true
  // 矛盾データ防衛: outdoor_only / not_allowed は店内OKにしない
  return false
}

/**
 * テラス席・屋外席で同伴できる確認があるスポットか。
 * - pet_terrace_only === true（テラス/外席限定の確認済み）
 * - pet_friendly_status === 'outdoor_only'（ステータス側の屋外同伴確認。フラグ欠落のフォールバック）
 * unknown・店内のみ可は含めない。
 */
export function placeIsTerracePetOk(p: PetPolicySource): boolean {
  if (p.pet_friendly_status === 'not_allowed') return false
  if (p.pet_terrace_only === true) return true
  // 検証済み outdoor_only はテラス/屋外同伴の確定シグナル（フラグ未整備のレガシー行を救済）
  if (p.pet_friendly_status === 'outdoor_only') return true
  return false
}

/** スポット詳細の同伴可否バッジ。tone は表示色の使い分け用 */
export type PetPolicyBadge = {
  label: string
  tone: 'ok' | 'terrace' | 'caution'
}

/** 同伴可否バッジの内容を決める。根拠になるデータが無いときは null（何も出さない） */
export function petPolicyBadge(p: PetPolicySource): PetPolicyBadge | null {
  if (p.pet_indoor_allowed === true) return { label: '店内OK・確認済み', tone: 'ok' }
  if (placeIsTerracePetOk(p)) return { label: 'テラス席のみOK', tone: 'terrace' }
  if (p.pet_friendly_status === 'not_allowed') return { label: '同伴不可の可能性', tone: 'caution' }
  return null
}
