import { Redirect } from 'expo-router'

/**
 * 旧「検索ホーム」ルート（4タブ改修で概念ごと廃止）。
 * 通知・保存状態・外部リンクからの旧遷移互換のため、検索タブ（マップ）へリダイレクトする。
 * 旧実装のコンポーネント群（components/search/ 等）は各タブへ移設済みか、フラグ付きで温存。
 */
export default function LegacySearchRedirect() {
  return <Redirect href="/(tabs)" />
}
