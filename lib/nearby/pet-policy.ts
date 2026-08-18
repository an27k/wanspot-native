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
  /**
   * 判定の根拠。verified は「検証を試みた」であって「裏が取れた」ではなく、
   * verified=true かつ実際は推測の行が 8,241件ある。信頼の指標にはこちらを使う。
   */
  pet_policy_evidence?: 'official' | 'aggregator' | 'reviews' | 'inferred' | null
}

/** 根拠の強さ。表示の言い切り方をここで決める */
export function evidenceTone(p: PetPolicySource): 'confirmed' | 'reported' | 'weak' {
  const e = p.pet_policy_evidence
  if (e === 'official' || e === 'aggregator') return 'confirmed'
  if (e === 'reviews') return 'reported'
  return 'weak'
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

/**
 * 根拠の強さをラベルに反映する。
 *
 * 「確認済み」を名乗れるのは一次情報か掲載系で裏が取れたものだけ。口コミ由来は
 * 伝聞なのでそう書く。推測は何も足さない（可否だけ述べる）。
 *
 * 裏付けの無い「確認済み」は無根拠の断定より悪い。飼い主はそう書かれた情報を
 * 最も強く信じるので、そこを外すと他の正しい判定まで信用を失う。
 */
function withEvidence(base: string, p: PetPolicySource): string {
  const tone = evidenceTone(p)
  if (tone === 'confirmed') return `${base}・確認済み`
  if (tone === 'reported') return `${base}（口コミによる）`
  return base
}

/**
 * 同伴可否バッジの内容を決める。
 *
 * 分岐が indoor / terrace / not_allowed の3つしかなく、leashed_only と
 * 「allowed だが屋内可否は未確認」が揃って null に落ちていた。実データで測ると
 * 70%（50件中35件）がバッジ無しで、「リード着用なら同伴可」と
 * 「そもそも誰も調べていない」が画面上で見分けられなかった。
 *
 * 検証済みで分かっていることは、弱い情報でも必ず何か出す。出さないのは
 * 本当に未検証のときだけにする。
 */
export function petPolicyBadge(p: PetPolicySource): PetPolicyBadge | null {
  if (p.pet_friendly_status === 'not_allowed') return { label: '同伴不可の可能性', tone: 'caution' }
  /*
    「確認済み」は名乗らない。

    pet_friendly_verified が立っていても、その根拠が推測のものが実測で 2,602件（確定
    ステータスの16.1%）ある。注記に「推測」「要確認」「web検索は実施できず」と自分で
    書き残しながら確定値になっている行が、そのまま同じバッジで出ていた。

    根拠の質を伴わない「確認済み」は、無根拠の断定より悪い。飼い主はそう書かれた
    情報を最も強く信じる。根拠の質を返す仕組みができるまでは、可否だけを述べる。
  */
  if (p.pet_indoor_allowed === true) {
    return { label: withEvidence('店内OK', p), tone: 'ok' }
  }
  if (placeIsTerracePetOk(p)) return { label: withEvidence('テラス席のみOK', p), tone: 'terrace' }
  if (p.pet_friendly_status === 'leashed_only') {
    return { label: withEvidence('リード着用で同伴OK', p), tone: 'ok' }
  }
  // 同伴自体は確認済みだが、屋内まで入れるかは分かっていない。
  // 「OK」だけを出すと店内に入れる前提で来てしまうので、そこは言い切らない
  if (p.pet_friendly_status === 'allowed') {
    return { label: withEvidence('同伴OK・店内は要確認', p), tone: 'ok' }
  }
  // 検証は済んでいるが可否を判定できなかった。未検証（何も出さない）とは別の状態
  if (p.pet_friendly_verified === true) return { label: '同伴可否は要確認', tone: 'caution' }
  return null
}
