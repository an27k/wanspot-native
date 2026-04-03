import { Image } from 'expo-image'
import type { ImageStyle, StyleProp } from 'react-native'

type Props = {
  uri: string
  style?: StyleProp<ImageStyle>
  /** リスト等で URL が差し替わるときのビットマップ再利用用 */
  recyclingKey?: string
  /** ファーストビュー用に先にデコードさせる */
  priority?: 'low' | 'normal' | 'high'
}

/**
 * まとめ記事などリモート画像用。メモリ＋ディスクキャッシュ・同一 URL の再利用を前提にした薄ラッパー。
 */
export function ArticleRemoteImage({ uri, style, recyclingKey, priority = 'normal' }: Props) {
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey ?? uri}
      priority={priority}
      transition={0}
    />
  )
}
