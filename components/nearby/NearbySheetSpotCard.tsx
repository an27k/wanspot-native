import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { WanspotIconHeart } from '@/components/icons/WanspotIconHeart'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { listImageExpoProps } from '@/lib/images/remoteImageDefaults'
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg'
import { formatDistanceLabel, calcDistanceMeters } from '@/lib/nearby/geo'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import { spotPhotoUrl } from '@/lib/wanspot-api'
import { IconPaw } from '@/components/IconPaw'
import { colors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'

const IconStar = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill={colors.primary} stroke={colors.primary} strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

const IconHeart = ({ filled }: { filled: boolean }) => (
  <WanspotIconHeart size={18} filled={filled} />
)

const IconGoogle = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
)

const IconMoney = ({ filled }: { filled: boolean }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill={filled ? colors.primary : '#e8e8e8'}>
    <Circle cx="12" cy="12" r="10" />
    <SvgText x="12" y="16" textAnchor="middle" fontSize="12" fill={filled ? colors.textPrimary : '#bbb'} fontWeight="bold">
      ¥
    </SvgText>
  </Svg>
)

const PriceLevel = ({ level }: { level: number | null }) => {
  // 価格帯が不明なスポットは大半のため、記号は出さずに詰める（旧実装の「?」は意味が伝わらない）
  if (level === null || level === undefined) return null
  return (
    <View style={styles.priceRow}>
      {[1, 2, 3, 4].map((i) => (
        <IconMoney key={i} filled={i <= level} />
      ))}
    </View>
  )
}

export function NearbySheetSpotCard({
  spot,
  userLocation,
  onPress,
  compact = false,
  variant = 'list',
  liked = false,
  onToggleLike,
  onClose,
}: {
  spot: SheetSpot
  userLocation: { lat: number; lng: number } | null
  onPress: () => void
  compact?: boolean
  /** list: 右上にいいね / popup: 右上に×（ピン真上のポップアップ用） / carousel: 地図下の横スワイプカルーセル用（住所なし・高さ固定寄り） */
  variant?: 'list' | 'popup' | 'carousel'
  liked?: boolean
  onToggleLike?: () => void
  onClose?: () => void
}) {
  const uri = spotPhotoUrl(spot.photoRef, 'thumbnail')

  const distLabel =
    userLocation &&
    formatDistanceLabel(calcDistanceMeters(userLocation.lat, userLocation.lng, spot.lat, spot.lng))

  return (
    <TouchableOpacity
      style={[
        styles.card,
        compact && styles.cardCompact,
        variant === 'popup' && styles.cardPopup,
        variant === 'carousel' && styles.cardCarousel,
      ]}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {variant === 'popup' ? (
        <TouchableOpacity
          style={styles.cornerBtn}
          onPress={(e) => {
            e.stopPropagation?.()
            onClose?.()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="閉じる"
        >
          <Ionicons name="close" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.cornerBtn}
          onPress={(e) => {
            e.stopPropagation?.()
            onToggleLike?.()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'いいねを外す' : 'いいね'}
        >
          <IconHeart filled={liked} />
        </TouchableOpacity>
      )}

      {!compact ? (
        <View style={[styles.cardPhoto, variant === 'carousel' && styles.cardPhotoCarousel]}>
          {uri ? (
            <Image source={{ uri }} style={styles.cardImg} contentFit="cover" recyclingKey={uri} {...listImageExpoProps} />
          ) : (
            // 写真が無いスポットでも画像枠は残し、カード高さを一定に保つ
            <View style={styles.cardPhotoEmpty}>
              <IconPaw size={26} color={colors.dogPhotoPlaceholderPaw} />
            </View>
          )}
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.spotCat}>{spot.category}</Text>
          <View style={styles.cardMeta}>
            {spot.rating ? (
              <View style={styles.rateRow}>
                <IconGoogle />
                <IconStar />
                <Text style={styles.rateSmall}>{spot.rating}</Text>
                <PriceLevel level={spot.priceLevel} />
              </View>
            ) : null}
            {distLabel ? <Text style={styles.distSmall}>{distLabel}</Text> : null}
          </View>
        </View>
        <Text style={styles.spotName} numberOfLines={compact || variant === 'carousel' ? 1 : 2}>
          {spot.name}
        </Text>
        {!compact && variant !== 'carousel' ? (
          <Text style={styles.spotAddr} numberOfLines={2}>{spot.address}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  cardCompact: { marginBottom: 0 },
  cardPopup: { marginBottom: 0 },
  cardCarousel: { marginBottom: 0 },
  cardPhotoCarousel: { height: 96 },
  cornerBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cardPhoto: {
    height: 120,
    backgroundColor: '#e8e4de',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  cardImg: { width: '100%', height: '100%' },
  cardPhotoEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 12, gap: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spotCat: {
    ...type.label,
    backgroundColor: GOOGLE_HOME.listGenreBg,
    borderWidth: 1,
    borderColor: GOOGLE_HOME.listGenreBorder,
    color: GOOGLE_HOME.listGenreText,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateSmall: { ...type.caption, color: '#888' },
  // 距離は右端に単独で置く数値。行内の他のメタより太くして目的地までの遠近を拾えるようにする
  distSmall: { ...type.caption, fontWeight: '700' as const, color: '#aaa' },
  // 地図と並ぶカードでも店名が起点。carousel / compact は numberOfLines 1 のまま
  spotName: { ...type.heading, color: colors.textPrimary },
  spotAddr: { ...type.caption, color: '#aaa' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
})
