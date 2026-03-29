import { inMemoryStorage } from '@/lib/in-memory-storage'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { WalkAreaTagPicker } from '@/components/walk-area/WalkAreaTagPicker'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { OB_LOCATION_KEY } from '@/lib/onboarding-constants'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'

const STEP_DOTS = 5

export default function WalkAreaOnboardingPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [wideNearby, setWideNearby] = useState(false)
  const padTop = insets.top + 16
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  useEffect(() => {
    void (async () => {
      const raw = await inMemoryStorage.getItem(OB_LOCATION_KEY)
      if (!raw) {
        router.replace('/onboarding/location')
        return
      }
      try {
        const p = JSON.parse(raw) as { lat?: number; lng?: number }
        if (typeof p.lat === 'number' && typeof p.lng === 'number') {
          setAnchor({ lat: p.lat, lng: p.lng })
        }
      } catch {
        router.replace('/onboarding/location')
      }
    })()
  }, [router])

  const canNext = walkAreaTagsForUpsert(tags).length > 0

  const goNext = async () => {
    const normalized = walkAreaTagsForUpsert(tags)
    if (normalized.length === 0) return
    await inMemoryStorage.setItem(
      'ob_area',
      JSON.stringify({
        tags: normalized,
        useLocationBased: wideNearby,
      })
    )
    router.push('/onboarding/owner')
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.main}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: padTop, paddingBottom: padBottom, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.headRow}>
          <View style={styles.brandRow}>
            <OnboardingBrand />
            <Text style={styles.brandTxt}>wanspot</Text>
          </View>
          <View style={styles.dots}>
            {Array.from({ length: STEP_DOTS }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i <= 3 ? '#FFD84D' : '#e0e0e0' }]} />
            ))}
          </View>
        </View>

        <Text style={styles.h2}>
          よく散歩する{'\n'}エリアを選んでください
        </Text>
        <Text style={styles.hint}>現在地から約10km以内の主要エリアを提案しています。検索で他の地域も選べます（1つ以上必須）。</Text>

        <WalkAreaTagPicker anchor={anchor} value={tags} onChange={setTags} />

        <View style={styles.switchRow}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchTitle}>近くのスポットを広めに表示</Text>
            <Text style={styles.switchSub}>オンにすると、一覧の距離の初期値を約3kmにします（あとから変更可）</Text>
          </View>
          <Switch
            value={wideNearby}
            onValueChange={setWideNearby}
            trackColor={{ false: '#e0e0e0', true: '#FFE8A8' }}
            thumbColor={wideNearby ? colors.brand : '#f4f4f4'}
          />
        </View>

        <TouchableOpacity style={[styles.next, !canNext && styles.nextOff]} onPress={() => void goNext()} disabled={!canNext}>
          <Text style={styles.nextTxt}>次へ →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  main: { flex: 1, backgroundColor: '#fff' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontWeight: '800', fontSize: 14, color: '#1a1a1a' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: '#1a1a1a' },
  hint: { fontSize: 12, color: '#aaa', lineHeight: 18 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#f7f6f3',
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  switchTextCol: { flex: 1 },
  switchTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  switchSub: { fontSize: 11, color: '#888', lineHeight: 16 },
  next: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { opacity: 0.45 },
  nextTxt: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
})
