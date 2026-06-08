import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ReviewAlbumTimeline } from '@/components/album/ReviewAlbumTimeline'
import { DogIdentityProfile } from '@/components/dog/DogIdentityProfile'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { fetchVisitPlates, type VisitPlate } from '@/lib/visits-memories'

/** アルバムタブ（route: camera） */
export default function ReviewAlbumTab() {
  const insets = useSafeAreaInsets()
  const { dog, setDog, userId, loading: dogLoading } = useDogProfile()
  const [plates, setPlates] = useState<VisitPlate[]>([])
  const [albumLoading, setAlbumLoading] = useState(true)

  const loadAlbum = useCallback(async () => {
    if (!userId) {
      setPlates([])
      setAlbumLoading(false)
      return
    }
    setAlbumLoading(true)
    const next = await fetchVisitPlates(userId)
    setPlates(next)
    setAlbumLoading(false)
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void loadAlbum()
    }, [loadAlbum])
  )

  const padBottom = insets.bottom + TAB_BAR_HEIGHT + 24

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: padBottom }}
        showsVerticalScrollIndicator={false}
      >
        {dogLoading && !dog ? (
          <View style={styles.dogLoad}>
            <RunningDog label="プロフィールを読み込み中..." />
          </View>
        ) : dog && userId ? (
          <DogIdentityProfile dog={dog} userId={userId} onUpdated={setDog} variant="album" />
        ) : !dogLoading ? (
          <Text style={styles.noDog}>愛犬プロフィールがまだありません</Text>
        ) : null}

        <ReviewAlbumTimeline
          userId={userId}
          dogName={dog?.name ?? null}
          plates={plates}
          loading={albumLoading}
          onReload={() => void loadAlbum()}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  dogLoad: { paddingVertical: 32, alignItems: 'center' },
  noDog: {
    marginTop: 16,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
