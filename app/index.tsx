import { Redirect } from 'expo-router'

/** debug minimal: ログイン／オンボーディングゲートなしでタブへ直行 */
export default function Index() {
  return <Redirect href="/(tabs)" />
}
