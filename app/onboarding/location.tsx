import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'
import * as Location from 'expo-location'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { OB_LOCATION_KEY } from '@/lib/onboarding-constants'
import { colors } from '@/constants/colors'

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
          '現在地を取得できませんでした',
          '近くの散歩エリアを提案するには位置情報が使えます。設定アプリから変更できます。',
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
      <OnboardingStepHeader step={1} />

      <Text style={styles.h2}>近くのワンちゃんスポットを表示するために</Text>
      <Text style={styles.hint}>
        wanspotはあなたの現在地をもとに、近くのワンちゃんスポットの表示とお散歩予報（気温）に位置情報を使います。別の許可項目はありません。
      </Text>
      <Text style={styles.reassure}>あとから設定アプリから変更できます。</Text>

      <TouchableOpacity style={[styles.next, busy && styles.nextOff]} onPress={() => void requestAndSave()} disabled={busy}>
        <Text style={styles.nextTxt}>{busy ? '確認中...' : '次へ'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#fff' },
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: colors.textPrimary },
  hint: { fontSize: 13, color: '#888', lineHeight: 20 },
  reassure: { fontSize: 12, color: '#aaa', lineHeight: 18 },
  next: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { opacity: 0.6 },
  nextTxt: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
})
