/**
 * ADS_ENABLED=false 時の Metro エイリアス先（expo-tracking-transparency の代替）。
 *
 * なぜ要るか:
 * 広告が無効なら ATT のダイアログは一度も出ない。にもかかわらず
 * expo-tracking-transparency をリンクしたままにすると、バイナリに
 * AppTrackingTransparency.framework と NSUserTrackingUsageDescription だけが残る。
 * これは 2026-08-12 の審査で **Guideline 2.1** として差し戻された原因そのもの:
 *   「ATT を使っているのに、許可ダイアログが見つからない」
 *
 * react-native-google-mobile-ads は既に autolinking / plugins / Metro の
 * 3か所で除外していたが、ATT だけが漏れていた。同じ扱いに揃える。
 *
 * 実行されることは無い（ADS_ENABLED=false のとき呼び出し側が手前で return する）が、
 * 静的 import を解決するために型と戻り値だけ本物に合わせておく。
 */

/** expo-tracking-transparency の PermissionStatus と同じ文字列 */
export type PermissionStatus = 'granted' | 'undetermined' | 'denied'

export type TrackingPermissionResponse = {
  status: PermissionStatus
  granted: boolean
  canAskAgain: boolean
  expires: 'never'
}

const DENIED: TrackingPermissionResponse = {
  status: 'denied',
  granted: false,
  canAskAgain: false,
  expires: 'never',
}

/**
 * 本物はダイアログを出す。スタブは **何も表示せず** denied を返す。
 * 広告を再開するときは EXPO_PUBLIC_ADS_ENABLED=true にすること
 * （Metro のエイリアスが外れて本物に戻る）。
 */
export async function requestTrackingPermissionsAsync(): Promise<TrackingPermissionResponse> {
  return DENIED
}

export async function getTrackingPermissionsAsync(): Promise<TrackingPermissionResponse> {
  return DENIED
}

/** 未許可なので常に false。呼び出し側は非パーソナライズ広告にフォールバックする */
export function isAvailable(): boolean {
  return false
}

export function useTrackingPermissions(): [TrackingPermissionResponse, () => Promise<TrackingPermissionResponse>] {
  return [DENIED, requestTrackingPermissionsAsync]
}
