import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'
import * as Location from 'expo-location'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { OB_LOCATION_GRANTED, OB_LOCATION_KEY, ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding-constants'
import { colors } from '@/constants/colors'

export default function OnboardingLocationPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const padTop = insets.top + 16
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  const continueWithoutLocation = async () => {
    await AsyncStorage.setItem(OB_LOCATION_GRANTED, '0')
    router.push('/onboarding/dog')
  }

  const requestAndSave = async () => {
    setBusy(true)
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          '現在地を取得できませんでした',
          '位置情報が使えない場合は、次の画面で散歩エリアを選べます。あとから設定アプリから変更できます。',
          [
            { text: '散歩エリアを選ぶ', onPress: () => void continueWithoutLocation() },
            ...(canAskAgain !== false ? ([{ text: '再試行', onPress: () => void requestAndSave() }] as const) : []),
            { text: '設定を開く', onPress: () => void Linking.openSettings() },
          ]
        )
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      await AsyncStorage.setItem(OB_LOCATION_GRANTED, '1')
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
      {/*
        この時点では許可/拒否が未確定なので総ステップ数も決まらない。最大の3で見せておく。
        許可されれば次の画面で2に減る。進捗が縮むのは歓迎されるが、2で見せて後から3に
        増えると「終わらない」印象になり、最初の画面での離脱に直結する。
      */}
      <OnboardingStepHeader step={1} totalSteps={ONBOARDING_TOTAL_STEPS} />

      <Text style={styles.h2}>近くのワンちゃんスポットを表示するために</Text>
      <Text style={styles.hint}>
        wanspotはあなたの現在地をもとに、近くのワンちゃんスポットの表示とお散歩予報（気温）に位置情報を使います。
      </Text>
      <Text style={styles.reassure}>許可すると散歩エリアの質問はスキップできます。あとから設定アプリから変更できます。</Text>

      <Pressable style={[styles.next, busy && styles.nextOff]} onPress={() => void requestAndSave()} disabled={busy}>
        <Text style={styles.nextTxt}>{busy ? '確認中...' : '次へ'}</Text>
      </Pressable>

      <Pressable style={styles.skipBtn} onPress={() => void continueWithoutLocation()} disabled={busy}>
        <Text style={styles.skipTxt}>スキップ（あとで散歩エリアを選ぶ）</Text>
      </Pressable>
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
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipTxt: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
})
