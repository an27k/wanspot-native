import { useEffect, useRef } from 'react'
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BrandLoader } from '@/components/common/BrandLoader'
import { AiPlanGeneratingAd } from '@/components/ai-plan/AiPlanGeneratingAd'
import { AiPlanProgressSteps } from '@/components/ai-plan/AiPlanProgressSteps'
import type { NarrationPhaseId } from '@/lib/ai-plan/narration'
import { TOKENS } from '@/constants/color-tokens'
import { formatAiPlanDogDisplayName } from '@/lib/ai-plan/formatters'

export function AiPlanGenerating({
  dogName,
  currentStep,
  currentText,
  completedPhaseIds,
}: {
  dogName: string
  currentStep: number
  currentText: string
  completedPhaseIds: readonly NarrationPhaseId[]
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.ringOuter} />
          <Animated.View style={[styles.ringInner, { transform: [{ rotate }] }]} />
          <View style={styles.dogMark}>
            <BrandLoader size={96} />
          </View>
        </View>

        <Text style={styles.title}>{displayName}のプランを作成中</Text>
        <Text style={styles.sub}>だいたい15秒で完成します</Text>

        <AiPlanProgressSteps
          currentStep={currentStep}
          currentText={currentText}
          completedPhaseIds={completedPhaseIds}
        />

        <AiPlanGeneratingAd />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: TOKENS.surface.secondary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
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
    fontSize: 16,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: TOKENS.text.tertiary,
    marginBottom: 24,
    textAlign: 'center',
  },
})
