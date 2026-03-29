import { inMemoryStorage } from '@/lib/in-memory-storage'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { OB_LOCATION_KEY } from '@/lib/onboarding-constants'

const SIZES = [
  { key: 'XS', label: 'XS', desc: '〜4kg · 〜25cm' },
  { key: 'S', label: 'S', desc: '4〜10kg · 25〜40cm' },
  { key: 'M', label: 'M', desc: '10〜25kg · 40〜60cm' },
  { key: 'L', label: 'L', desc: '25〜45kg · 60〜75cm' },
  { key: 'XL', label: 'XL', desc: '45kg〜 · 75cm〜' },
] as const

type Size = (typeof SIZES)[number]['key']

const STEP_DOTS = 5

export default function SizePage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [selected, setSelected] = useState<Size | null>(null)

  useEffect(() => {
    void (async () => {
      const raw = await inMemoryStorage.getItem(OB_LOCATION_KEY)
      if (!raw) router.replace('/onboarding/location')
    })()
  }, [router])
  const padTop = insets.top + 16
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  const goNext = async () => {
    if (!selected) return
    await inMemoryStorage.setItem('ob_size', JSON.stringify({ size: selected }))
    router.push('/onboarding/area')
  }

  return (
    <ScrollView
      style={styles.main}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: padTop, paddingBottom: padBottom, gap: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headRow}>
        <View style={styles.brandRow}>
          <OnboardingBrand />
          <Text style={styles.brandTxt}>wanspot</Text>
        </View>
        <View style={styles.dots}>
          {Array.from({ length: STEP_DOTS }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= 2 ? '#FFD84D' : '#e0e0e0' }]} />
          ))}
        </View>
      </View>
      <Text style={styles.h2}>サイズは？</Text>
      <View style={{ gap: 12 }}>
        {SIZES.map(({ key, label, desc }) => {
          const isSelected = selected === key
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSelected(key)}
              style={[styles.card, isSelected ? styles.cardOn : styles.cardOff]}
            >
              <Text style={[styles.cardTxt, isSelected ? { color: '#1a1a1a' } : { color: '#aaa' }]}>
                {label} <Text style={{ fontWeight: '400', fontSize: 12 }}>{desc}</Text>
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <TouchableOpacity style={[styles.next, !selected && styles.nextOff]} disabled={!selected} onPress={() => void goNext()}>
        <Text style={[styles.nextTxt, !selected && { color: '#ccc' }]}>次へ →</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#fff' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontWeight: '800', fontSize: 14, color: '#1a1a1a' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  h2: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  card: { width: '100%', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16 },
  cardOn: { backgroundColor: '#FFF9E0', borderWidth: 2, borderColor: '#FFD84D' },
  cardOff: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8' },
  cardTxt: { fontWeight: '700', fontSize: 14 },
  next: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { backgroundColor: '#f5f5f5' },
  nextTxt: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
})
