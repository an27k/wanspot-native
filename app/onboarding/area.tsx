import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { WalkAreaTagPicker } from '@/components/walk-area/WalkAreaTagPicker'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import {
  OB_DOG_KEY,
  OB_LOCATION_GRANTED,
  OB_LOCATION_KEY,
  OB_WALK_AREA_TAGS_KEY,
} from '@/lib/onboarding-constants'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'

export default function WalkAreaOnboardingPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const styles = useThemedStyles(createStyles)
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const padTop = insets.top + 16
  const padBottom = insets.bottom + 32

  useEffect(() => {
    void (async () => {
      // 位置情報の可否が未確定なら、この画面には来ないはず。先に聞きに戻す
      const granted = await AsyncStorage.getItem(OB_LOCATION_GRANTED)
      if (granted === null) {
        router.replace('/onboarding/location')
        return
      }
      const raw = await AsyncStorage.getItem(OB_LOCATION_KEY)
      if (!raw) return
      try {
        const p = JSON.parse(raw) as { lat?: number; lng?: number }
        if (typeof p.lat === 'number' && typeof p.lng === 'number') {
          setAnchor({ lat: p.lat, lng: p.lng })
        }
      } catch {
        /* 位置情報なしでもタグ手入力で続行 */
      }
    })()
  }, [router])

  const canNext = walkAreaTagsForUpsert(tags).length > 0

  const goNext = async () => {
    const normalized = walkAreaTagsForUpsert(tags)
    if (normalized.length === 0 || submitting) return
    setSubmitting(true)
    const rawDog = await AsyncStorage.getItem(OB_DOG_KEY)
    if (!rawDog) {
      Alert.alert('エラー', '入力データが見つかりません。最初からやり直してください。')
      setSubmitting(false)
      return
    }
    // 完了は次の締め画面で行う。ここで即アプリ本体に落とすと「これで終わり？」になる
    await AsyncStorage.setItem(OB_WALK_AREA_TAGS_KEY, JSON.stringify(normalized))
    router.push('/onboarding/ready')
    setSubmitting(false)
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.main}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: padTop, paddingBottom: padBottom, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* 位置情報の代わりに「どこで探すか」を決める画面なので、location と同じ 2段目 */}
        <OnboardingStepHeader step={2} />

        <Text style={styles.h2}>よく散歩する{'\n'}エリアを選んでください</Text>
        <Text style={styles.hint}>
          位置情報が使えない場合のフォールバックです。近くのおすすめに使います。あとから設定でも変更できます。
        </Text>

        <View style={styles.pickerCard}>
          <WalkAreaTagPicker anchor={anchor} value={tags} onChange={setTags} />
        </View>

        <TouchableOpacity
          style={[styles.next, (!canNext || submitting) && styles.nextOff]}
          onPress={() => void goNext()}
          disabled={!canNext || submitting}
        >
          <Text style={styles.nextTxt}>{submitting ? '保存中...' : 'はじめる'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  main: { flex: 1, backgroundColor: colors.paper },
  h2: { ...type.title, color: colors.textPrimary, textAlign: 'center' },
  hint: { ...type.caption, color: colors.textSecondary, textAlign: 'center' },
  pickerCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  next: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { opacity: 0.45 },
  nextTxt: { ...type.button, color: colors.onPrimary },
})
