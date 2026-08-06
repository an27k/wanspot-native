import { StyleSheet, Text, View } from 'react-native'
import { ArticleRemoteImage } from '@/components/articles/ArticleRemoteImage'
import { PressableScale } from '@/components/common/PressableScale'
import { GoogleGlassPanel } from '@/components/search/GoogleGlassPanel'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { type } from '@/constants/typography'
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
 * タイトルはリスト行の型（17px）。行のラベルなので大きさは row に合わせ、
 * 記事の見出しであることは太さで出す。
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
  areaTxt: { ...type.label, color: '#2A2522' },
  genreTxt: { ...type.label, color: GOOGLE_HOME.textSecondary },
  // ハンドオフの新着リストは 15/700。17px にすると1行あたり約15字まで落ちて、
  // 長いSEOタイトルが2行クランプで切れる件数が増える
  title: {
    ...type.row,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700' as const,
    color: GOOGLE_HOME.textPrimary,
  },
})
