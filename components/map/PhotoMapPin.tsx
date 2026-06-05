import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { GenreIcon } from '@/components/nearby/GenreIcon'
import { MAP_GENRE_COLOR, MAP_LIKE_COLOR, MAP_VISITED_CHECK_COLOR, type MapGenreKey } from '@/lib/nearby/constants'
import { listImageExpoProps } from '@/lib/images/remoteImageDefaults'
import { spotPhotoUrl } from '@/lib/wanspot-api'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'

function HeartBadge() {
  return (
    <View style={styles.badge}>
      <Svg width={10} height={10} viewBox="0 0 24 24" fill={MAP_LIKE_COLOR}>
        <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </Svg>
    </View>
  )
}

function CheckBadge() {
  return (
    <View style={styles.badge}>
      <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12.5l4 4 10-10.5"
          stroke={MAP_VISITED_CHECK_COLOR}
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

/** Snapchat 風：丸いスポット写真ピン */
export function PhotoMapPin({
  spot,
  genre,
  liked,
  visited,
}: {
  spot: SheetSpot
  genre: MapGenreKey
  liked?: boolean
  visited?: boolean
}) {
  const uri = spotPhotoUrl(spot.photoRef, 'thumbnail')
  const ring = MAP_GENRE_COLOR[genre]

  return (
    <View style={styles.outer}>
      <View style={[styles.ring, { borderColor: ring }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.photo} contentFit="cover" recyclingKey={uri} {...listImageExpoProps} />
        ) : (
          <View style={[styles.ph, { backgroundColor: ring }]}>
            <GenreIcon genre={genre} size={18} color="#fff" />
          </View>
        )}
      </View>
      {liked ? <HeartBadge /> : null}
      {!liked && visited ? <CheckBadge /> : null}
    </View>
  )
}

const PIN = 40

const styles = StyleSheet.create({
  outer: { width: PIN + 8, height: PIN + 8, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderWidth: 2.5,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  photo: { width: '100%', height: '100%' },
  ph: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
})
