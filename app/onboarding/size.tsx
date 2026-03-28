import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'

const SIZES = [
  { key: 'XS', label: 'XS', desc: '〜4kg · 〜25cm' },
  { key: 'S', label: 'S', desc: '4〜10kg · 25〜40cm' },
  { key: 'M', label: 'M', desc: '10〜25kg · 40〜60cm' },
  { key: 'L', label: 'L', desc: '25〜45kg · 60〜75cm' },
  { key: 'XL', label: 'XL', desc: '45kg〜 · 75cm〜' },
] as const

type Size = (typeof SIZES)[number]['key']

export default function SizePage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [selected, setSelected] = useState<Size | null>(null)
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  return (
    <ScrollView style={styles.main} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: padBottom, gap: 20 }}>
      <View style={styles.headRow}>
        <View style={styles.brandRow}>
          <OnboardingBrand width={20} height={23} />
          <Text style={styles.brandTxt}>wanspot</Text>
        </View>
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
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
      <TouchableOpacity
        style={[styles.next, !selected && styles.nextOff]}
        disabled={!selected}
        onPress={async () => {
          if (!selected) return
          await AsyncStorage.setItem('ob_size', JSON.stringify({ size: selected }))
          try {
            const raw = await AsyncStorage.getItem('ob_dog')
            const rawOwner = await AsyncStorage.getItem('ob_owner')
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !raw) {
              router.replace('/(tabs)')
              return
            }
            let ownerParsed: {
              parent_type?: 'papa' | 'mama'
              ownerYear?: string | null
              ownerMonth?: string | null
              ownerDay?: string | null
            } | null = null
            if (rawOwner) {
              try {
                ownerParsed = JSON.parse(rawOwner) as typeof ownerParsed
              } catch {
                ownerParsed = null
              }
            }
            const userBirthday =
              ownerParsed?.ownerYear && ownerParsed?.ownerMonth && ownerParsed?.ownerDay
                ? ownerBirthdayToYmd(
                    String(ownerParsed.ownerYear),
                    String(ownerParsed.ownerMonth),
                    String(ownerParsed.ownerDay)
                  )
                : null
            const dog = JSON.parse(raw) as {
              name?: string
              year?: string
              month?: string
              breed?: string
              gender?: 'male' | 'female'
              vaccineCombo?: boolean
              vaccineRabies?: boolean
              dogPhotoUrl?: string | null
            }
            const birthday =
              dog.year && dog.month ? `${dog.year}-${String(dog.month).padStart(2, '0')}-01` : null
            const today = new Date().toISOString().slice(0, 10)
            await supabase.from('users').upsert({
              id: user.id,
              name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'ユーザー',
              parent_type: ownerParsed?.parent_type ?? 'papa',
              birthday: userBirthday,
            })
            await supabase.from('dogs').upsert(
              {
                user_id: user.id,
                name: dog.name ?? '',
                birthday,
                breed: dog.breed ?? null,
                gender: dog.gender ?? null,
                photo_url: dog.dogPhotoUrl ?? null,
                rabies_vaccinated: dog.vaccineRabies === true,
                vaccine_vaccinated: dog.vaccineCombo === true,
                rabies_vaccinated_at: dog.vaccineRabies ? today : null,
                vaccine_vaccinated_at: dog.vaccineCombo ? today : null,
              },
              { onConflict: 'user_id' }
            )
            await AsyncStorage.multiRemove(['ob_dog', 'ob_size', 'ob_owner'])
          } catch (e) {
            Alert.alert('エラー', e instanceof Error ? e.message : String(e))
            return
          }
          router.replace('/(tabs)')
        }}
      >
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
