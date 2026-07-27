import { useEffect } from 'react'
import type * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { MEMORY_ANNIVERSARY_TYPE } from '@/lib/notifications/memory-anniversary'
import { WALK_ADVICE_MORNING_TYPE } from '@/lib/notifications/walk-advice-morning'
import { REVIEW_ALBUM_TAB_ENABLED } from '@/lib/feature-flags'
import { loadNotificationsModule } from '@/lib/notifications/notifications-module'

let handlerInstalled = false

/** フォアグラウンド受信時もバナー表示する（音・バッジは使わない） */
function installNotificationHandler(module: NonNullable<ReturnType<typeof loadNotificationsModule>>): void {
  if (handlerInstalled) return
  handlerInstalled = true
  module.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

function navigateFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
  push: (href: { pathname: string; params?: Record<string, string> }) => void
): void {
  const data = response?.notification.request.content.data as
    | { type?: string; url?: string; visitId?: string }
    | undefined
  if (!data?.url) return

  // 朝のお散歩予報 → 検索タブ（上部のお散歩予報カード）へ
  if (data.type === WALK_ADVICE_MORNING_TYPE) {
    push({ pathname: data.url })
    return
  }

  if (data.type !== MEMORY_ANNIVERSARY_TYPE) return
  const pathname =
    data.url === '/(tabs)/camera' && !REVIEW_ALBUM_TAB_ENABLED ? '/(tabs)' : data.url
  push({
    pathname,
    params: data.visitId ? { focusVisitId: data.visitId } : undefined,
  })
}

/** 通知タップ → アルバムタブの該当レビューへのディープリンク */
export function useNotificationDeeplink(): void {
  const router = useRouter()

  useEffect(() => {
    // ネイティブモジュール未搭載のバイナリでは通知機能ごと無効化（起動クラッシュ防止）
    const module = loadNotificationsModule()
    if (!module) return

    installNotificationHandler(module)

    const push = (href: { pathname: string; params?: Record<string, string> }) => {
      router.push(href as never)
    }

    // アプリ起動中 / バックグラウンドからのタップ
    const sub = module.addNotificationResponseReceivedListener((response) => {
      navigateFromResponse(response, push)
    })

    // 通知タップでコールドスタートした場合: ナビゲータのマウントを待ってから遷移
    const timer = setTimeout(() => {
      void module
        .getLastNotificationResponseAsync()
        .then((response) => navigateFromResponse(response, push))
        .catch(() => undefined)
    }, 600)

    return () => {
      sub.remove()
      clearTimeout(timer)
    }
  }, [router])
}
