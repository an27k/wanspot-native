import { requireOptionalNativeModule } from 'expo-modules-core'

type NotificationsModule = typeof import('expo-notifications')

let cached: NotificationsModule | null | undefined

/**
 * expo-notifications を安全に読み込む。
 *
 * ネイティブモジュール（ExpoNotifications pod）が入っていないバイナリ
 * （pod install 前のローカルビルドや、固定 runtimeVersion の OTA アップデートを
 * 受け取った旧バイナリ）では、`import 'expo-notifications'` 自体が
 * requireNativeModule で例外を投げて起動時クラッシュになる。
 * そのため先にネイティブ側の存在を確認してから遅延 require する。
 */
export function loadNotificationsModule(): NotificationsModule | null {
  if (cached !== undefined) return cached
  cached = requireOptionalNativeModule('ExpoNotificationsEmitter')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as NotificationsModule)
    : null
  return cached
}
