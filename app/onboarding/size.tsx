import { useEffect } from 'react'
import { useRouter } from 'expo-router'

/** 旧4ステップ用ルート。愛犬ステップへリダイレクト */
export default function SizePageRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/onboarding/dog')
  }, [router])
  return null
}
