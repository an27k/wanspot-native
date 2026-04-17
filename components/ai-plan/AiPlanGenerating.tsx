import { useEffect, useMemo, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { RunningDog } from '@/components/DogStates'

const PHASE_LABEL: Record<string, string> = {
  auth_ok: '認証しています…',
  loading_profile: 'ワンちゃんの情報を確認しています…',
  resolving_area: 'エリアを調べています…',
  fetching_candidates: 'ぴったりの場所を探しています…',
  llm: 'プランを組み立てています…',
  routes_resolving: '移動ルートを計算しています…',
  saving: 'プランを保存しています…',
}

export function AiPlanGenerating({ phase, areaLabel, dogName }: { phase: string | null; areaLabel: string; dogName: string }) {
  const fade = useRef(new Animated.Value(0)).current
  useEffect(() => {
    fade.setValue(0)
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start()
  }, [phase, fade])

  const msg = useMemo(() => {
    const base = phase ? (PHASE_LABEL[phase] ?? '準備しています…') : '準備しています…'
    if (phase === 'loading_profile') return `${dogName}の情報を確認しています…`
    if (phase === 'resolving_area') return `${areaLabel}を調べています…`
    return base
  }, [phase, areaLabel, dogName])

  return (
    <View style={styles.wrap}>
      <RunningDog label="" />
      <Animated.View style={{ opacity: fade }}>
        <Text style={styles.msg}>{msg}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 12, paddingHorizontal: 16, alignItems: 'center' },
  msg: { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#888' },
})
