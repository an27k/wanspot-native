import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { OwnerBirthdayPickers, ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'

const PARENT_OPTIONS = [
  { value: 'papa' as const, label: 'パパ' },
  { value: 'mama' as const, label: 'ママ' },
]

export default function OwnerOnboardingPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [parentType, setParentType] = useState<'papa' | 'mama' | null>(null)
  const [ownerYear, setOwnerYear] = useState('')
  const [ownerMonth, setOwnerMonth] = useState('')
  const [ownerDay, setOwnerDay] = useState('')
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  const ownerBirthdayYmd = ownerBirthdayToYmd(ownerYear, ownerMonth, ownerDay)
  const canNext = parentType !== null && ownerBirthdayYmd !== null

  const goNext = async () => {
    if (!canNext) return
    await AsyncStorage.setItem(
      'ob_owner',
      JSON.stringify({
        parent_type: parentType,
        ownerYear,
        ownerMonth,
        ownerDay,
      })
    )
    router.push('/onboarding/size')
  }

  return (
    <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: padBottom, paddingHorizontal: 20, paddingTop: 40, gap: 20 }}>
      <View style={styles.headRow}>
        <View style={styles.brandRow}>
          <OnboardingBrand width={20} height={23} />
          <Text style={styles.brandTxt}>wanspot</Text>
        </View>
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= 1 ? '#FFD84D' : '#e0e0e0' }]} />
          ))}
        </View>
      </View>

      <Text style={styles.h2}>
        あなたについて{'\n'}教えてください
      </Text>

      <View>
        <Text style={styles.label}>肩書き</Text>
        <View style={styles.row2}>
          {PARENT_OPTIONS.map((opt) => {
            const on = parentType === opt.value
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.half, on ? styles.halfOn : styles.halfOff]}
                onPress={() => setParentType(opt.value)}
              >
                <Text
                  style={[
                    styles.halfTxt,
                    on && (opt.value === 'papa' ? { color: colors.genderMale } : { color: colors.genderFemale }),
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <OwnerBirthdayPickers
        compact
        year={ownerYear}
        month={ownerMonth}
        day={ownerDay}
        onChangeYear={setOwnerYear}
        onChangeMonth={setOwnerMonth}
        onChangeDay={setOwnerDay}
      />

      <TouchableOpacity style={[styles.next, !canNext && styles.nextOff]} disabled={!canNext} onPress={() => void goNext()}>
        <Text style={[styles.nextTxt, !canNext && { color: '#ccc' }]}>次へ →</Text>
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
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: '#1a1a1a' },
  label: { fontSize: 12, color: '#aaa', marginBottom: 4 },
  row2: { flexDirection: 'row', gap: 8 },
  half: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  halfOn: { backgroundColor: '#FFF9E0', borderWidth: 2, borderColor: '#FFD84D' },
  halfOff: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8' },
  halfTxt: { fontSize: 16, fontWeight: '800', color: '#aaa' },
  next: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { backgroundColor: '#f5f5f5' },
  nextTxt: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
})
