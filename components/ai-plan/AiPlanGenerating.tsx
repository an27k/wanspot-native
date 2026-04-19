import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { LoadingDogSvg } from '@/components/common/LoadingDog'
import { AiPlanProgressSteps } from '@/components/ai-plan/AiPlanProgressSteps'
import { TOKENS } from '@/constants/color-tokens'
import { formatAiPlanDogDisplayName } from '@/lib/ai-plan/formatters'

export function AiPlanGenerating({
  phase,
  dogName,
}: {
  phase: string | null
  dogName: string
}) {
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [spin])

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const displayName = formatAiPlanDogDisplayName(dogName)

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.ringOuter} />
        <Animated.View style={[styles.ringInner, { transform: [{ rotate }] }]} />
        <View style={styles.dogMark}>
          <LoadingDogSvg />
        </View>
      </View>

      <Text style={styles.title}>{displayName}のプランを作成中</Text>
      <Text style={styles.sub}>だいたい15秒で完成します</Text>

      <AiPlanProgressSteps phase={phase} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: TOKENS.surface.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  hero: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: TOKENS.brand.yellow,
    borderRightColor: 'transparent',
    borderRadius: 60,
    opacity: 0.3,
  },
  ringInner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 3,
    borderColor: TOKENS.brand.yellow,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRadius: 50,
  },
  dogMark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontSize: 11,
    color: TOKENS.text.tertiary,
    marginBottom: 24,
    textAlign: 'center',
  },
})
