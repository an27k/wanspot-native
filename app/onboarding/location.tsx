import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'
import * as Location from 'expo-location'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { OB_LOCATION_KEY } from '@/lib/onboarding-constants'

const STEP_DOTS = 5

export default function OnboardingLocationPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const padTop = insets.top + 16
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  const requestAndSave = async () => {
    setBusy(true)
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          '位置情報が必要です',
          '近くの散歩エリアを提案するために、現在地の利用を許可してください。設定アプリからも変更できます。',
          [
            { text: '閉じる', style: 'cancel' },
            ...(canAskAgain !== false ? ([{ text: '再試行', onPress: () => void requestAndSave() }] as const) : []),
            { text: '設定を開く', onPress: () => void Linking.openSettings() },
          ]
        )
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      await AsyncStorage.setItem(
        OB_LOCATION_KEY,
        JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      )
      router.push('/onboarding/dog')
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '位置情報を取得できませんでした。')
    } finally {
      setBusy(false)
    }
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
            <View key={i} style={[styles.dot, { backgroundColor: i <= 0 ? '#FFD84D' : '#e0e0e0' }]} />
          ))}
        </View>
      </View>

      <Text style={styles.h2}>位置情報の利用を許可してください</Text>
      <Text style={styles.hint}>
        wanspotはあなたの現在地をもとに、近くのワンちゃんスポットやイベントを表示します。サービスを利用するために位置情報の許可が必要です。
      </Text>

      <TouchableOpacity style={[styles.next, busy && styles.nextOff]} onPress={() => void requestAndSave()} disabled={busy}>
        <Text style={styles.nextTxt}>{busy ? '確認中...' : '位置情報を許可して次へ'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#fff' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontWeight: '800', fontSize: 14, color: '#2b2a28' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: '#2b2a28' },
  hint: { fontSize: 13, color: '#888', lineHeight: 20 },
  next: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { opacity: 0.6 },
  nextTxt: { fontSize: 16, fontWeight: '700', color: '#2b2a28' },
})
