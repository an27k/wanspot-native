import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { MEMORY_ANNIVERSARY_TYPE } from '@/lib/notifications/memory-anniversary'

// フォアグラウンド受信時もバナー表示する（音・バッジは使わない）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

function navigateFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
  push: (href: { pathname: string; params?: Record<string, string> }) => void
): void {
  const data = response?.notification.request.content.data as
    | { type?: string; url?: string; visitId?: string }
    | undefined
  if (!data?.url || data.type !== MEMORY_ANNIVERSARY_TYPE) return
  push({
    pathname: data.url,
    params: data.visitId ? { focusVisitId: data.visitId } : undefined,
  })
}

/** 通知タップ → アルバムタブの該当レビューへのディープリンク */
export function useNotificationDeeplink(): void {
  const router = useRouter()

  useEffect(() => {
    const push = (href: { pathname: string; params?: Record<string, string> }) => {
      router.push(href as never)
    }

    // アプリ起動中 / バックグラウンドからのタップ
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromResponse(response, push)
    })

    // 通知タップでコールドスタートした場合: ナビゲータのマウントを待ってから遷移
    const timer = setTimeout(() => {
      void Notifications.getLastNotificationResponseAsync()
        .then((response) => navigateFromResponse(response, push))
        .catch(() => undefined)
    }, 600)

    return () => {
      sub.remove()
      clearTimeout(timer)
    }
  }, [router])
}
