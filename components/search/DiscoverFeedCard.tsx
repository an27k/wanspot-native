import { StyleSheet, Text, View } from 'react-native'
import { ArticleRemoteImage } from '@/components/articles/ArticleRemoteImage'
import { PressableScale } from '@/components/common/PressableScale'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'

type Props = {
  title: string
  summary: string
  imageUrl: string | null
  keywords: string[]
  recyclingKey: string
  onPress: () => void
}

/** まとめ記事タブ先頭の編集部特集カード。写真を主役にした縦型レイアウト。 */
export function DiscoverFeedCard({
  title,
  summary,
  imageUrl,
  keywords,
  recyclingKey,
  onPress,
}: Props) {
  const styles = useThemedStyles(createStyles)
  const kicker = keywords.slice(0, 2).join(' · ') || 'ワンスポまとめ'

  return (
    <PressableScale onPress={onPress}>
      <View style={styles.shell}>
        {imageUrl ? (
          <ArticleRemoteImage
            uri={resizePlacesImageUrl(imageUrl, 'card')}
            style={styles.hero}
            recyclingKey={recyclingKey}
            priority="normal"
          />
        ) : (
          <View style={[styles.hero, styles.thumbPh]} />
        )}
        <View style={styles.textCol}>
          <Text style={styles.kicker} numberOfLines={1}>
            {kicker}
          </Text>
          <Text style={styles.title} numberOfLines={3}>
            {title}
          </Text>
          <Text style={styles.summary} numberOfLines={2}>
            {summary}
          </Text>
        </View>
      </View>
    </PressableScale>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  /*
    半透明ガラスからテーマ準拠の不透明カードへ。グラデーション背景に半透明を重ねると
    カードの輪郭が地に溶けて、要素の優先順位が読めなくなっていた。
    まとめ記事の行カードと同じ質感に揃える
  */
  shell: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  textCol: { gap: 7, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  kicker: {
    ...type.label,
    color: colors.textMuted,
  },
  title: {
    ...type.heading,
    color: colors.textPrimary,
  },
  summary: {
    ...type.caption,
    color: colors.textSecondary,
  },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.dogPhotoPlaceholderBg,
  },
  thumbPh: { opacity: 0.5 },
})
