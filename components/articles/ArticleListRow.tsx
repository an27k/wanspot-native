import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ArticleRemoteImage } from '@/components/articles/ArticleRemoteImage'
import { PressableScale } from '@/components/common/PressableScale'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
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
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <PressableScale onPress={onPress}>
      <View style={styles.shell}>
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
          <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
        </View>
      </View>
    </PressableScale>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  /*
    半透明ガラスから不透明な白カードへ。グラデーション背景に半透明を重ねると
    カードの輪郭が地に溶けて、どこからどこまでが1件なのか読めなくなっていた。
    他タブのカードと同じ質感に揃える
  */
  shell: {
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  thumb: {
    width: 88,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.dogPhotoPlaceholderBg,
  },
  thumbPh: {},
  textCol: { flex: 1, gap: 5, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 120,
  },
  areaTxt: { ...type.label, color: colors.textSecondary },
  genreTxt: { ...type.label, color: colors.textMuted },
  // ハンドオフの新着リストは 15/700。17px にすると1行あたり約15字まで落ちて、
  // 長いSEOタイトルが2行クランプで切れる件数が増える
  title: {
    ...type.row,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
})
