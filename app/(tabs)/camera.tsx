import { useCallback, useEffect, useMemo, useState } from 'react'
import { InteractionManager, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ReviewAlbumTimeline } from '@/components/album/ReviewAlbumTimeline'
import { ReviewTutorialModal } from '@/components/album/ReviewTutorialModal'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'
import { GoogleHomeBackground } from '@/components/search/GoogleHomeBackground'
import { DogIdentityProfile } from '@/components/dog/DogIdentityProfile'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { useTabBarScroll } from '@/hooks/useTabBarScroll'
import { track } from '@/lib/analytics'
import { syncMemoryAnniversaryNotifications } from '@/lib/notifications/memory-anniversary'
import { hasSeenReviewTutorial } from '@/lib/review/tutorial-storage'
import { fetchVisitPlates, type VisitPlate } from '@/lib/visits-memories'
import { computeVlogProgressFromPlates } from '@/lib/album/vlog-progress'

/** アルバムタブ（route: camera） */
export default function ReviewAlbumTab() {
  const insets = useSafeAreaInsets()
  const { dog, setDog, userId, loading: dogLoading } = useDogProfile()
  const params = useLocalSearchParams<{ focusVisitId?: string }>()
  const focusVisitId = typeof params.focusVisitId === 'string' ? params.focusVisitId : null
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

  // 「◯ヶ月前の今日」ローカル通知をアルバムデータから同期（ベストエフォート）
  useEffect(() => {
    if (albumLoading || !userId) return
    void syncMemoryAnniversaryNotifications(plates, dog?.name)
  }, [albumLoading, userId, plates, dog?.name])

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
          {dogLoading ? (
            <View style={styles.bootCard}>
              <Text style={styles.bootKicker}>Review Album</Text>
              <Text style={styles.bootTitle}>思い出を読み込み中</Text>
              <Text style={styles.bootSub}>レビューカードを準備しています</Text>
              <View style={styles.bootSkeleton}>
                <View style={styles.bootPhoto} />
                <View style={styles.bootLineWide} />
                <View style={styles.bootLine} />
              </View>
            </View>
          ) : (
            <>
              {dog && userId ? (
                <DogIdentityProfile
                  dog={dog}
                  userId={userId}
                  onUpdated={setDog}
                  variant="album"
                  ringEnergized={vlogUnlocked}
                />
              ) : (
                <Text style={styles.noDog}>愛犬プロフィールがまだありません</Text>
              )}

              <ReviewAlbumTimeline
                userId={userId}
                dogName={dog?.name ?? null}
                dogPhotoUrl={dog?.photo_url ?? null}
                plates={plates}
                loading={albumLoading}
                onReload={() => void loadAlbum()}
                onOpenTutorial={() => setTutorialOpen(true)}
                focusVisitId={focusVisitId}
              />
            </>
          )}
        </Animated.ScrollView>
        <ReviewTutorialModal visible={tutorialOpen} onClose={() => setTutorialOpen(false)} dogName={dog?.name} />
      </GoogleHomeBackground>
    </ScreenErrorBoundary>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  bootCard: {
    marginTop: 88,
    marginHorizontal: 16,
    borderRadius: 30,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  bootKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.74)',
    textTransform: 'uppercase',
  },
  bootTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '900',
    color: GOOGLE_HOME.textPrimary,
  },
  bootSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: GOOGLE_HOME.textSecondary,
  },
  bootSkeleton: {
    marginTop: 18,
    borderRadius: 24,
    padding: 10,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  bootPhoto: { height: 176, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.48)' },
  bootLineWide: { width: '70%', height: 15, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.68)' },
  bootLine: { width: '44%', height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.52)' },
  noDog: {
    marginTop: 16,
    fontSize: 13,
    color: GOOGLE_HOME.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
