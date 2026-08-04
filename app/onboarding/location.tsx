import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'
import * as Location from 'expo-location'
import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { OB_DOG_KEY, OB_LOCATION_GRANTED, OB_LOCATION_KEY } from '@/lib/onboarding-constants'
import { completeOnboarding } from '@/lib/onboarding-complete'
import { dogLabel } from '@/lib/dog-label'
import { colors } from '@/constants/colors'

export default function OnboardingLocationPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  /** 未入力・保存漏れなら null のまま。dogLabel が「うちの子」に落とす */
  const [dogName, setDogName] = useState<string | null>(null)
  const name = dogLabel(dogName)
  const padTop = insets.top + 16
  const padBottom = insets.bottom + 24

  // 直前の愛犬入力から名前を借りる。オンボの最後に来たからこそ使える
  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(OB_DOG_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as { name?: unknown }
        const saved = typeof parsed?.name === 'string' ? parsed.name.trim() : ''
        if (saved) setDogName(saved)
      } catch {
        /* 読めなければ「うちの子」のまま。ここで止める理由はない */
      }
    })()
  }, [])

  /** 位置情報なしで進む人は、代わりに散歩エリアを選んでもらう */
  const continueWithoutLocation = async () => {
    await AsyncStorage.setItem(OB_LOCATION_GRANTED, '0')
    router.push('/onboarding/area')
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
      // 許可できた人はここで完了。散歩エリアの質問はスキップする
      const result = await completeOnboarding({ walkAreaTags: [], router })
      if (!result.ok) Alert.alert('保存に失敗しました', result.message)
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '位置情報を取得できませんでした。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView
      style={styles.main}
      contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* 入力は終わっているのでドットは埋まる。「準備ができた」を見た目でも伝える */}
      <OnboardingStepHeader step={2} />

      {/*
        見出しは必ず2行。犬の名前は長さが読めないので、高さを固定したうえで
        adjustsFontSizeToFit に縮めさせる。行数が変わると下の余白ごとレイアウトが
        跳ねるため、名前で見え方が変わらないことを優先している。
      */}
      <View style={styles.headingBox}>
        <Text
          style={styles.h2}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {name}とのお出かけの{'\n'}準備ができました！
        </Text>
      </View>

      <Text style={styles.hint}>
        現在地を許可すると、今いる場所のまわりで{name}と入れるスポットが提案できます。{'\n'}
        また、今日の天候を分析してお散歩に向いた時間もお知らせします。{'\n'}
        あとからアプリで変更もできます。
      </Text>

      {/* 上の説明と下のボタンを引き離し、画面下部の空白を詰める */}
      <View style={styles.spacer} />

      <Pressable style={[styles.next, busy && styles.nextOff]} onPress={() => void requestAndSave()} disabled={busy}>
        <Text style={styles.nextTxt} numberOfLines={1}>
          {/* 「許可して〜」は Apple が 5.1.1(iv) で2回却下した文言。中立語を維持すること */}
          {busy ? '準備中...' : 'はじめる'}
        </Text>
      </Pressable>

      <Pressable style={styles.skipBtn} onPress={() => void continueWithoutLocation()} disabled={busy}>
        <Text style={styles.skipTxt}>あとで設定する</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#fff' },
  /** flexGrow で画面いっぱいに広げ、spacer にボタンを下へ押させる */
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 16 },
  /** 2行ぶんの高さを確保しておく。名前が長くても行数もこの高さも変わらない */
  headingBox: { height: 76, justifyContent: 'center', marginTop: 8 },
  h2: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  hint: { fontSize: 13, color: '#8A8A8A', lineHeight: 22, textAlign: 'left' },
  spacer: { flex: 1, minHeight: 24 },
  next: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  nextOff: { opacity: 0.6 },
  nextTxt: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipTxt: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
})
