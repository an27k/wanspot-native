import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { IconPaw } from '@/components/IconPaw'
import { colors } from '@/constants/colors'
import { sanitizeImageForDisplay } from '@/lib/images/sanitize-for-display'

type Props = {
  uri: string | null | undefined
  size?: number
}

/** 犬アバター — デコード前に JPEG 化、失敗時は SVG プレースホルダ */
export function SafeDogAvatar({ uri, size = 40 }: Props) {
  const [displayUri, setDisplayUri] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (!uri) {
      setDisplayUri(null)
      return
    }

    if (uri.startsWith('file://') || uri.startsWith('data:')) {
      setDisplayUri(uri)
      return
    }

    setDisplayUri(uri)
    let cancelled = false
    void (async () => {
      const safe = await sanitizeImageForDisplay(uri)
      if (cancelled) return
      if (safe) {
        setFailed(false)
        setDisplayUri(safe)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [uri])

  if (!uri || failed || !displayUri) {
    return (
      <View style={styles.placeholder}>
        <IconPaw size={size} color={colors.dogPhotoPlaceholderPaw} />
      </View>
    )
  }

  return (
    <Image
      source={{ uri: displayUri }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      autoplay={false}
      recyclingKey={uri}
      onError={() => setFailed(true)}
    />
  )
}

const styles = StyleSheet.create({
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
