import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { LoadingDogSvg } from '@/components/common/LoadingDog'

interface PostOnboardingTutorialModalProps {
  visible: boolean
  dogName: string
  onDismiss: () => void
}

export function PostOnboardingTutorialModal({
  visible,
  dogName,
  onDismiss,
}: PostOnboardingTutorialModalProps) {
  const heart1Anim = useRef(new Animated.Value(0)).current
  const heart2Anim = useRef(new Animated.Value(0)).current
  const heart3Anim = useRef(new Animated.Value(0)).current
  const cardAnim = useRef(new Animated.Value(0)).current

  const safeDogName = useMemo(() => dogName?.trim() || 'ワン', [dogName])

  useEffect(() => {
    if (!visible) {
      cardAnim.stopAnimation()
      heart1Anim.stopAnimation()
      heart2Anim.stopAnimation()
      heart3Anim.stopAnimation()
      cardAnim.setValue(0)
      heart1Anim.setValue(0)
      heart2Anim.setValue(0)
      heart3Anim.setValue(0)
      return
    }

    const animateHeart = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      )

    const cardIn = Animated.timing(cardAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    })

    const h1 = animateHeart(heart1Anim, 200)
    const h2 = animateHeart(heart2Anim, 800)
    const h3 = animateHeart(heart3Anim, 1400)

    cardIn.start()
    h1.start()
    h2.start()
    h3.start()

    return () => {
      cardAnim.stopAnimation()
      heart1Anim.stopAnimation()
      heart2Anim.stopAnimation()
      heart3Anim.stopAnimation()
      h1.stop()
      h2.stop()
      h3.stop()
    }
  }, [visible, cardAnim, heart1Anim, heart2Anim, heart3Anim])

  const cardScale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  })

  const heartTransform = (anim: Animated.Value) => ({
    opacity: anim.interpolate({
      inputRange: [0, 0.2, 0.8, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -36],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.6, 1, 0.9],
        }),
      },
    ],
  })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View style={[styles.card, { opacity: cardAnim, transform: [{ scale: cardScale }] }]}>
            <View style={styles.visualArea}>
              <Animated.View style={[styles.heart, styles.heartLeft, heartTransform(heart1Anim)]}>
                <Text style={styles.heartText}>♥</Text>
              </Animated.View>
              <Animated.View style={[styles.heart, styles.heartRight, heartTransform(heart2Anim)]}>
                <Text style={styles.heartText}>♥</Text>
              </Animated.View>
              <Animated.View style={[styles.heart, styles.heartCenter, heartTransform(heart3Anim)]}>
                <Text style={[styles.heartText, styles.heartTextSmall]}>♥</Text>
              </Animated.View>

              <View style={styles.dogContainer}>
                <LoadingDogSvg />
              </View>
            </View>

            <View style={styles.textArea}>
              <Text style={styles.title}>
                気になるスポットに{'\n'}
                <Text style={styles.titleHighlight}>♥</Text> を残そう
              </Text>
              <Text style={styles.body}>
                {safeDogName}ちゃんとあなたの好みを集めて、{'\n'}
                ぴったりのお出かけ場所をAIが提案します
              </Text>
            </View>

            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            >
              <Text style={styles.ctaText}>さがしてみる</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 360)

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  visualArea: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  dogContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  heartLeft: {
    left: 36,
    top: 60,
  },
  heartRight: {
    right: 36,
    top: 60,
  },
  heartCenter: {
    top: 12,
    left: '50%',
    marginLeft: -16,
  },
  heartText: {
    fontSize: 28,
    color: '#FFC107',
  },
  heartTextSmall: {
    fontSize: 20,
  },
  textArea: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: 0.3,
  },
  titleHighlight: {
    color: '#FFC107',
    fontSize: 24,
  },
  body: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#FFC107',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonPressed: {
    backgroundColor: '#FFB300',
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
})

