import { Redirect } from 'expo-router'

/** 旧「散歩エリア」設定 — 愛犬情報編集へ統合 */
export default function WalkAreaSettingsRedirect() {
  return <Redirect href="/settings/dog-profile" />
}
