import { StyleSheet, Text, View } from 'react-native'
import { ArticleRemoteImage } from '@/components/articles/ArticleRemoteImage'
import { PressableScale } from '@/components/common/PressableScale'
import { GoogleGlassPanel } from '@/components/search/GoogleGlassPanel'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { type } from '@/constants/typography'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'

type Props = {
  title: string
  summary: string
  imageUrl: string | null
  keywords: string[]
  recyclingKey: string
  onPress: () => void
}

/** Google Discover 風の横型記事カード（左テキスト・右サムネ） */
export function DiscoverFeedCard({
  title,
  summary,
  imageUrl,
  keywords,
  recyclingKey,
  onPress,
}: Props) {
  const kicker = keywords.slice(0, 2).join(' · ') || 'ワンスポまとめ'

  return (
    <PressableScale onPress={onPress}>
      <GoogleGlassPanel style={styles.shell}>
        <View style={styles.row}>
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
          {imageUrl ? (
            <ArticleRemoteImage
              uri={resizePlacesImageUrl(imageUrl, 'thumbnail')}
              style={styles.thumb}
              recyclingKey={recyclingKey}
              priority="normal"
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPh]} />
          )}
        </View>
      </GoogleGlassPanel>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  shell: { marginBottom: GOOGLE_HOME.gapCard },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  textCol: { flex: 1, gap: 6, minWidth: 0 },
  kicker: {
    ...type.label,
    color: GOOGLE_HOME.textKicker,
  },
  // 記事一覧の先頭に置くヒーローカードの見出し。
  // title(26) はテキスト列が約200pxしかなく3行でも見出しが切れるため heading に留める
  title: {
    ...type.heading,
    color: GOOGLE_HOME.textPrimary,
  },
  summary: {
    ...type.caption,
    color: GOOGLE_HOME.textSecondary,
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  thumbPh: { opacity: 0.5 },
})
