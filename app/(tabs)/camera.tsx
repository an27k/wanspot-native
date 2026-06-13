import { useCallback, useEffect, useMemo, useState } from 'react'
import { InteractionManager, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ReviewAlbumTimeline } from '@/components/album/ReviewAlbumTimeline'
import { ReviewTutorialModal } from '@/components/album/ReviewTutorialModal'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'
import { GoogleHomeBackground } from '@/components/search/GoogleHomeBackground'
import { DogIdentityProfile } from '@/components/dog/DogIdentityProfile'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { RunningDog } from '@/components/DogStates'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { useTabBarScroll } from '@/hooks/useTabBarScroll'
import { track } from '@/lib/analytics'
import { hasSeenReviewTutorial } from '@/lib/review/tutorial-storage'
import { fetchVisitPlates, type VisitPlate } from '@/lib/visits-memories'
import { computeVlogProgressFromPlates } from '@/lib/album/vlog-progress'

/** アルバムタブ（route: camera） */
export default function ReviewAlbumTab() {
  const insets = useSafeAreaInsets()
  const { dog, setDog, userId, loading: dogLoading } = useDogProfile()
  const [plates, setPlates] = useState<VisitPlate[]>([])
  const [albumLoading, setAlbumLoading] = useState(true)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialChecked, setTutorialChecked] = useState(false)
  const [boundaryKey, setBoundaryKey] = useState(0)

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

  useEffect(() => {
    if (tutorialChecked) return
    let cancelled = false
    void (async () => {
      const seen = await hasSeenReviewTutorial()
      if (cancelled) return
      setTutorialChecked(true)
      if (seen) return
      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return
        track('tutorial_view')
        setTutorialOpen(true)
      })
    })()
    return () => {
      cancelled = true
    }
  }, [tutorialChecked])

  const padBottom = insets.bottom + TAB_BAR_HEIGHT + 24
  const tabBarScrollHandler = useTabBarScroll()
  const vlogUnlocked = useMemo(
    () => computeVlogProgressFromPlates(plates).isUnlocked,
    [plates]
  )

  return (
    <ScreenErrorBoundary
      label="review"
      onRetry={() => {
        setBoundaryKey((k) => k + 1)
        void loadAlbum()
      }}
    >
      <GoogleHomeBackground key={boundaryKey}>
        <Animated.ScrollView
          style={styles.root}
          onScroll={tabBarScrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: padBottom }}
          showsVerticalScrollIndicator={false}
        >
          {dogLoading && !dog ? (
            <View style={styles.dogLoad}>
              <RunningDog label="プロフィールを読み込み中..." />
            </View>
          ) : dog && userId ? (
            <DogIdentityProfile
              dog={dog}
              userId={userId}
              onUpdated={setDog}
              variant="album"
              ringEnergized={vlogUnlocked}
            />
          ) : !dogLoading ? (
            <Text style={styles.noDog}>愛犬プロフィールがまだありません</Text>
          ) : null}

          <ReviewAlbumTimeline
            userId={userId}
            dogName={dog?.name ?? null}
            plates={plates}
            loading={albumLoading}
            onReload={() => void loadAlbum()}
            onOpenTutorial={() => setTutorialOpen(true)}
          />
        </Animated.ScrollView>
        <ReviewTutorialModal visible={tutorialOpen} onClose={() => setTutorialOpen(false)} dogName={dog?.name} />
      </GoogleHomeBackground>
    </ScreenErrorBoundary>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  dogLoad: { paddingVertical: 32, alignItems: 'center' },
  noDog: {
    marginTop: 16,
    fontSize: 13,
    color: GOOGLE_HOME.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
