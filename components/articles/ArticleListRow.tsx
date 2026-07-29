import { StyleSheet, Text, View } from 'react-native'
import { ArticleRemoteImage } from '@/components/articles/ArticleRemoteImage'
import { PressableScale } from '@/components/common/PressableScale'
import { GoogleGlassPanel } from '@/components/search/GoogleGlassPanel'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'

type Props = {
  title: string
  /** 例: 東京都（【】内から抽出。無ければ非表示） */
  area: string | null
  /** 例: カフェ */
  genreLabel: string | null
  imageUrl: string | null
  recyclingKey: string
  onPress: () => void
}

/**
 * まとめ記事のコンパクトなリスト行（キュレーションアプリのリスト型）。
 * 先頭のヒーローカード（DiscoverFeedCard）以降はこの行で情報密度を上げ、一覧性を確保する。
 * タイトルは 14px・行間1.55 程度（女性向けキュレーションメディアの標準域）。
 */
export function ArticleListRow({ title, area, genreLabel, imageUrl, recyclingKey, onPress }: Props) {
  return (
    <PressableScale onPress={onPress}>
      <GoogleGlassPanel style={styles.shell} radius={16}>
        <View style={styles.row}>
          {imageUrl ? (
            <ArticleRemoteImage
              uri={resizePlacesImageUrl(imageUrl, 'thumbnail')}
              style={styles.thumb}
              recyclingKey={recyclingKey}
              priority="low"
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPh]} />
          )}
          <View style={styles.textCol}>
            <View style={styles.metaRow}>
              {area ? (
                <View style={styles.areaPill}>
                  <Text style={styles.areaTxt} numberOfLines={1}>
                    {area}
                  </Text>
                </View>
              ) : null}
              {genreLabel ? <Text style={styles.genreTxt}>{genreLabel}</Text> : null}
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>
        </View>
      </GoogleGlassPanel>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  shell: { marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  thumbPh: {},
  textCol: { flex: 1, gap: 5, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaPill: {
    backgroundColor: GOOGLE_HOME.listGenreBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 120,
  },
  areaTxt: { fontSize: 10, fontWeight: '800', color: '#2A2522' },
  genreTxt: { fontSize: 11, fontWeight: '700', color: GOOGLE_HOME.textSecondary },
  title: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: GOOGLE_HOME.textPrimary,
  },
})
