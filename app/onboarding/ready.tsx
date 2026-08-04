import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { OB_DOG_KEY, OB_WALK_AREA_TAGS_KEY } from '@/lib/onboarding-constants'
import { completeOnboarding } from '@/lib/onboarding-complete'
import { dogLabel } from '@/lib/dog-label'
import { colors } from '@/constants/colors'

/**
 * 散歩エリアを選んだ人（＝位置情報を断った人）向けの締めの画面。
 *
 * 許可した人は location 画面がクッションになるが、断った人はエリア選択の直後に
 * アプリ本体へ落ちてしまい「これで終わり？」と不安になる。ここで同じ締めを挟む。
 * 位置情報を再度お願いはしない（断った直後にもう一度促すのは体験として押しつけがましく、
 * 審査でも許可の誘導と受け取られうる）。使えるようになる条件だけ静かに書いておく。
 */
export default function OnboardingReadyPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  /** 未入力・保存漏れなら null のまま。dogLabel が「うちの子」に落とす */
  const [dogName, setDogName] = useState<string | null>(null)
  const name = dogLabel(dogName)
  const padTop = insets.top + 16
  const padBottom = insets.bottom + 24

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(OB_DOG_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as { name?: unknown }
        const saved = typeof parsed?.name === 'string' ? parsed.name.trim() : ''
        if (saved) setDogName(saved)
      } catch {
        /* 読めなければ「うちの子」のまま */
      }
    })()
  }, [])

  const start = async () => {
    if (busy) return
    setBusy(true)
    try {
      const raw = await AsyncStorage.getItem(OB_WALK_AREA_TAGS_KEY)
      let tags: string[] = []
      try {
        const parsed = raw ? (JSON.parse(raw) as unknown) : null
        if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string')
      } catch {
        /* 壊れていてもエリアなしで完了させる。ここで詰まらせない */
      }
      const result = await completeOnboarding({ walkAreaTags: tags, router })
      if (!result.ok) {
        Alert.alert('保存に失敗しました', result.message)
        setBusy(false)
      }
    } catch (e) {
      Alert.alert('保存に失敗しました', e instanceof Error ? e.message : '通信エラーが発生しました。')
      setBusy(false)
    }
  }

  return (
    <ScrollView
      style={styles.main}
      contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
    >
      <OnboardingBrand />

      {/* location 画面と同じく、名前の長さで行数が変わらないよう高さを固定する */}
      <View style={styles.headingBox}>
        <Text style={styles.h2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
          {name}とのお出かけの{'\n'}準備ができました！
        </Text>
      </View>

      <Text style={styles.hint}>
        選んだエリアのまわりで、{name}と入れるスポットが提案できます。{'\n'}
        現在地を許可すると、今いる場所から探せるようになります。{'\n'}
        あとからアプリで変更もできます。
      </Text>

      <View style={styles.spacer} />

      <Pressable style={[styles.next, busy && styles.nextOff]} onPress={() => void start()} disabled={busy}>
        <Text style={styles.nextTxt} numberOfLines={1}>
          {busy ? '準備中...' : 'はじめる'}
        </Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 16 },
  headingBox: { height: 76, justifyContent: 'center', marginTop: 8 },
  h2: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
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
})
