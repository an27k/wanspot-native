import { useEffect, useState, type ReactNode } from 'react'
import { Image, type ImageContentFit, type ImageStyle } from 'expo-image'
import { StyleSheet, View, type StyleProp } from 'react-native'
import { sanitizeImageForDisplay } from '@/lib/images/sanitize-for-display'

type Props = {
  uri: string | null | undefined
  style?: StyleProp<ImageStyle>
  contentFit?: ImageContentFit
  fallback?: ReactNode
  /** リモート URI を JPEG に再エンコードしてから表示（indexed PNG / APNG 対策） */
  sanitize?: boolean
  recyclingKey?: string | null
}

/** expo-image + デコード失敗フォールバック（レビュータブ等） */
export function SafeRemoteImage({
  uri,
  style,
  contentFit = 'cover',
  fallback,
  sanitize = true,
  recyclingKey,
}: Props) {
  const [displayUri, setDisplayUri] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (!uri) {
      setDisplayUri(null)
      return
    }

    if (!sanitize || uri.startsWith('file://') || uri.startsWith('data:')) {
      setDisplayUri(uri)
      return
    }

    let cancelled = false
    void (async () => {
      const safe = await sanitizeImageForDisplay(uri)
      if (cancelled) return
      if (safe) {
        setDisplayUri(safe)
      } else {
        setFailed(true)
        setDisplayUri(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sanitize, uri])

  if (!uri || failed || !displayUri) {
    return <View style={[style, styles.fallback]}>{fallback ?? null}</View>
  }

  return (
    <Image
      source={{ uri: displayUri }}
      style={style}
      contentFit={contentFit}
      autoplay={false}
      recyclingKey={recyclingKey ?? uri}
      onError={() => setFailed(true)}
    />
  )
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#e8e8e8',
    overflow: 'hidden',
  },
})
