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
} from 'react-native'
import { colors } from '@/constants/colors'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { WalkAreaTagPicker } from '@/components/walk-area/WalkAreaTagPicker'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { OB_DOG_KEY, OB_LOCATION_GRANTED, OB_LOCATION_KEY } from '@/lib/onboarding-constants'
import { completeOnboarding } from '@/lib/onboarding-complete'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'

export default function WalkAreaOnboardingPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const padTop = insets.top + 16
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  useEffect(() => {
    void (async () => {
      const granted = await AsyncStorage.getItem(OB_LOCATION_GRANTED)
      if (granted === '1') {
        router.replace('/onboarding/dog')
        return
      }
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
    const result = await completeOnboarding({ walkAreaTags: normalized, router })
    if (!result.ok) {
      Alert.alert('保存に失敗しました', result.message)
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.main}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: padTop, paddingBottom: padBottom, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <OnboardingStepHeader step={3} totalSteps={3} />

        <Text style={styles.h2}>よく散歩する{'\n'}エリアを選んでください</Text>
        <Text style={styles.hint}>
          位置情報が使えない場合のフォールバックです。近くのおすすめに使います。あとから設定でも変更できます。
        </Text>

        <WalkAreaTagPicker anchor={anchor} value={tags} onChange={setTags} />

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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  main: { flex: 1, backgroundColor: '#fff' },
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: colors.textPrimary },
  hint: { fontSize: 12, color: '#888', lineHeight: 18 },
  next: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { opacity: 0.45 },
  nextTxt: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
})
