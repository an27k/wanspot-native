/**
 * 収益レイヤー1（AdMob ネイティブ）のマスタースイッチ。
 * false 時はリスト注入・SDK 初期化・ATT・プリロードを一切実行しない。
 * 将来再開: EXPO_PUBLIC_ADS_ENABLED=true またはここを true に。
 */
function parseAdsEnabledEnv(): boolean {
  const raw = process.env.EXPO_PUBLIC_ADS_ENABLED
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return false
}

export const ADS_ENABLED = parseAdsEnabledEnv()
