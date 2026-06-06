import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/AppHeader'
import { AlbumMosaic } from '@/components/album/AlbumMosaic'
import { UtsurunCameraModal } from '@/components/camera/UtsurunCameraModal'
import { DogIdentityProfile } from '@/components/dog/DogIdentityProfile'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import type { PickedImage } from '@/lib/image-picker'
import {
  CACHE_TTL,
  invalidateCache,
  isCacheFresh,
  readCache,
  writeCache,
} from '@/lib/client-cache'
import { fetchTodayPhoto, localDateKey, replaceTodayPhoto, saveDailyPhoto, type DogPhoto } from '@/lib/dog-photos'
import { supabase } from '@/lib/supabase'

/**
 * カメラタブ：愛犬SNSプロフィール + アルバム（1日1枚・30日保存は既存ロジックのまま）
 */
export default function CameraTab() {
  const insets = useSafeAreaInsets()
  const { dog, setDog, userId, loading: dogLoading } = useDogProfile()
  const [todayPhoto, setTodayPhoto] = useState<DogPhoto | null>(null)
  const [todayLoading, setTodayLoading] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadToday = useCallback(async (force = false) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setTodayPhoto(null)
      return
    }

    const cacheKey = `dog:today:${user.id}:${localDateKey()}`
    if (!force && isCacheFresh(cacheKey, CACHE_TTL.TODAY_PHOTO_MS)) {
      const cached = readCache<DogPhoto | null>(cacheKey)
      if (cached !== undefined) {
        setTodayPhoto(cached)
        return
      }
    }

    const stale = readCache<DogPhoto | null>(cacheKey)
    if (stale !== undefined) setTodayPhoto(stale)
    else setTodayLoading(true)

    const photo = await fetchTodayPhoto(user.id)
    writeCache(cacheKey, photo)
    setTodayPhoto(photo)
    setTodayLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadToday(false)
    }, [loadToday])
  )

  const persistPhoto = useCallback(
    async (image: PickedImage) => {
      if (!userId) return
      setSaving(true)
      try {
        const result = todayPhoto
          ? await replaceTodayPhoto(userId, image)
          : await saveDailyPhoto(userId, image)
        if (result.ok) {
          invalidateCache(`dog:today:${userId}:${localDateKey()}`)
          invalidateCache(`dog:album:${userId}`)
          setTodayPhoto(result.photo)
        } else if (result.reason === 'already_today') {
          Alert.alert('本日は撮影済みです', '今日の1枚はもう保存されています。')
          void loadToday(true)
        } else {
          Alert.alert('保存に失敗しました', '時間をおいて、もう一度お試しください。')
        }
      } finally {
        setSaving(false)
      }
    },
    [userId, todayPhoto, loadToday]
  )

  const handleOpenCamera = useCallback(() => {
    if (!userId) {
      Alert.alert('ログインが必要です', 'カメラで保存するにはログインしてください。')
      return
    }
    if (saving) return
    setCameraOpen(true)
  }, [userId, saving])

  const padBottom = insets.bottom + TAB_BAR_HEIGHT + 24

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: padBottom }}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader />

        {dogLoading && !dog ? (
          <View style={styles.dogLoad}>
            <RunningDog label="プロフィールを読み込み中..." />
          </View>
        ) : dog && userId ? (
          <DogIdentityProfile dog={dog} userId={userId} onUpdated={setDog} />
        ) : !dogLoading ? (
          <Text style={styles.noDog}>愛犬プロフィールがまだありません</Text>
        ) : null}

        <AlbumMosaic
          userId={userId}
          todayPhoto={todayPhoto}
          onCaptureToday={handleOpenCamera}
          onRetakeToday={handleOpenCamera}
          saving={saving || todayLoading}
        />
      </ScrollView>

      <UtsurunCameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onConfirm={(image) => persistPhoto(image)}
      />
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
