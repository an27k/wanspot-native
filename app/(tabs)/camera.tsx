import { useCallback, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { LoadingDogSvg } from '@/components/common/LoadingDog'
import { Image } from 'expo-image'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/AppHeader'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { takePhoto } from '@/lib/image-picker'
import { fetchTodayPhoto, saveDailyPhoto, type DogPhoto } from '@/lib/dog-photos'
import { supabase } from '@/lib/supabase'

/**
 * カメラタブ：1日1枚「今日の1枚」を撮影して保存する。
 * 保存した写真はマイページのアルバムに溜まっていく（保存は ALBUM_RETENTION_DAYS 日）。
 * ※レトロフィルター内蔵カメラは後続（品質改善フェーズ）で差し替え予定。
 */
export default function CameraTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [userId, setUserId] = useState<string | null>(null)
  const [todayPhoto, setTodayPhoto] = useState<DogPhoto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    if (!user) {
      setTodayPhoto(null)
      setLoading(false)
      return
    }
    setTodayPhoto(await fetchTodayPhoto(user.id))
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  const handleCapture = useCallback(async () => {
    if (!userId) {
      Alert.alert('ログインが必要です', 'カメラで保存するにはログインしてください。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ログイン', onPress: () => router.push('/(auth)/login') },
      ])
      return
    }
    const image = await takePhoto()
    if (!image) return
    setSaving(true)
    try {
      const result = await saveDailyPhoto(userId, image)
      if (result.ok) {
        setTodayPhoto(result.photo)
      } else if (result.reason === 'already_today') {
        Alert.alert('本日は撮影済みです', '今日の1枚はもう保存されています。また明日撮影できます。')
        void load()
      } else {
        Alert.alert('保存に失敗しました', '時間をおいて、もう一度お試しください。')
      }
    } finally {
      setSaving(false)
    }
  }, [userId, router, load])

  const padBottom = insets.bottom + TAB_BAR_HEIGHT + 24

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={[styles.body, { paddingBottom: padBottom }]}>
        {loading ? (
          <LoadingDogSvg size={56} />
        ) : todayPhoto ? (
          <>
            <Text style={styles.kicker}>今日の1枚</Text>
            <View style={styles.photoFrame}>
              <Image source={{ uri: todayPhoto.image_url }} style={styles.photo} contentFit="cover" transition={150} />
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark" size={14} color="#2b2a28" />
              </View>
            </View>
            <Text style={styles.doneTitle}>今日の1枚は保存済みです</Text>
            <Text style={styles.doneDesc}>また明日、新しい1枚を残しましょう。</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.push('/(tabs)/mypage')}>
              <Ionicons name="images-outline" size={18} color="#2b2a28" />
              <Text style={styles.primaryBtnTxt}>アルバムを見る</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="camera" size={40} color={colors.brandDark} />
            </View>
            <Text style={styles.title}>今日の1枚を残そう</Text>
            <Text style={styles.desc}>
              1日に保存できるのは1枚だけ。{'\n'}愛犬との特別な瞬間を切り取りましょう。
            </Text>
            <Pressable style={[styles.shutterBtn, saving && { opacity: 0.6 }]} onPress={handleCapture} disabled={saving}>
              {saving ? (
                <LoadingDogSvg size={28} />
              ) : (
                <>
                  <Ionicons name="camera" size={20} color="#2b2a28" />
                  <Text style={styles.shutterTxt}>カメラで撮る</Text>
                </>
              )}
            </Pressable>
          </>
        )}

      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  kicker: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 1 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF1E3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  desc: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  photoFrame: {
    width: 260,
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  photo: { width: '100%', height: '100%' },
  doneBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF8A1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4 },
  doneDesc: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  shutterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#FF8A1F',
    marginTop: 4,
    minWidth: 180,
    justifyContent: 'center',
  },
  shutterTxt: { fontSize: 15, fontWeight: '800', color: '#2b2a28' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  primaryBtnTxt: { fontSize: 14, fontWeight: '800', color: '#2b2a28' },
})
