import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { AvatarSunsetRing } from '@/components/dog/AvatarSunsetRing'
import { SafeDogAvatar } from '@/components/dog/SafeDogAvatar'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { REVIEW_TUTORIAL_SAMPLE_VLOG } from '@/lib/review/sample-vlog-video'
import { saveVlogToCameraRoll, shareVlogFile } from '@/lib/vlog/share'
import { track } from '@/lib/analytics'

const MINT = '#55E0B4'
const PURPLE = '#7F5CFF'

/** 犬アバター背後で明滅するオーラ + ゆっくり回るグラデーションリング */
function DogHeroAura({ children }: { children: React.ReactNode }) {
  const spin = useSharedValue(0)
  const glow = useSharedValue(0)

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false)
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [spin, glow])

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.34 + glow.value * 0.3,
    transform: [{ scale: 1 + glow.value * 0.09 }],
  }))

  return (
    <View style={styles.heroAuraWrap}>
      <Animated.View pointerEvents="none" style={[styles.heroGlow, glowStyle]}>
        <LinearGradient
          colors={['rgba(85,224,180,0.55)', 'rgba(127,92,255,0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.heroOrbit, orbitStyle]}>
        <View style={[styles.orbitDot, { top: -3, left: '50%', backgroundColor: MINT }]} />
        <View style={[styles.orbitDot, styles.orbitDotSmall, { bottom: 6, right: 2, backgroundColor: '#F27AD7' }]} />
        <View style={[styles.orbitDot, styles.orbitDotSmall, { top: 24, left: -2, backgroundColor: PURPLE }]} />
      </Animated.View>
      {children}
    </View>
  )
}

/** Phase 5 — 犬専用Vlogのプレビュー / 動画ファイル共有・カメラロール保存 */
export default function VlogPreviewScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ uri?: string; demo?: string }>()
  const { dog } = useDogProfile()
  const useDemo = params.demo === '1'
  const remoteUri = typeof params.uri === 'string' ? params.uri : null
  const missingVideo = !useDemo && !remoteUri

  const dogName = dog?.name?.trim() || '愛犬'

  const [ready, setReady] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true))
    return () => task.cancel()
  }, [])

  const source = useMemo(
    () => (useDemo ? REVIEW_TUTORIAL_SAMPLE_VLOG : { uri: remoteUri ?? '' }),
    [useDemo, remoteUri]
  )

  const player = useVideoPlayer(source, (p) => {
    p.loop = false
    p.muted = false
  })

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => {
      try {
        player.play()
      } catch {
        /* ignore */
      }
    }, 120)
    return () => clearTimeout(t)
  }, [ready, player])

  const onShare = async () => {
    if (sharing || !remoteUri || useDemo) return
    setSharing(true)
    track('vlog_share_start', { kind: 'file' })
    try {
      const res = await shareVlogFile(remoteUri)
      if (!res.ok) {
        Alert.alert('共有できませんでした', res.message)
        return
      }
      track('vlog_share_success', { kind: 'file' })
    } finally {
      setSharing(false)
    }
  }

  const onSave = async () => {
    if (saving || saved || !remoteUri || useDemo) return
    setSaving(true)
    track('vlog_save_start', {})
    try {
      const res = await saveVlogToCameraRoll(remoteUri)
      if (!res.ok) {
        Alert.alert('保存できませんでした', res.message)
        return
      }
      setSaved(true)
      track('vlog_save_success', {})
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      <View pointerEvents="none" style={styles.bgAura}>
        <View style={styles.bgAuraMint} />
        <View style={styles.bgAuraPurple} />
      </View>

      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headCenter}>
          <Text style={styles.kicker}>DOG VLOG</Text>
          <Text style={styles.title} numberOfLines={1}>
            {useDemo ? 'サンプルVlog' : `${dogName}の専用Vlog`}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.heroRow}>
        <DogHeroAura>
          <AvatarSunsetRing size={56} tone="aurora" energized>
            <SafeDogAvatar uri={dog?.photo_url} size={30} />
          </AvatarSunsetRing>
        </DogHeroAura>
        <View style={styles.heroCopy}>
          <Text style={styles.heroLead}>{useDemo ? 'こんなVlogができます' : 'できあがりました'}</Text>
          <Text style={styles.heroSub} numberOfLines={2}>
            {useDemo
              ? 'あなたの犬のレビューから、専用Vlogを自動でつくれます。'
              : `${dogName}のおでかけを1本のVlogにまとめました。`}
          </Text>
        </View>
      </Animated.View>

      {useDemo ? (
        <View style={styles.demoNotice}>
          <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.85)" />
          <Text style={styles.demoNoticeTxt}>
            これはサンプルです。あなたの写真・動画から作るVlog生成もお試しください。
          </Text>
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.playerFrame}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(85,224,180,0.9)', 'rgba(127,92,255,0.9)', 'rgba(242,122,215,0.75)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.playerWrap}>
          {missingVideo ? (
            <View style={styles.missingVideo}>
              <Ionicons name="alert-circle-outline" size={28} color="#fff" />
              <Text style={styles.missingVideoTxt}>
                生成済みVlogのURLがありません。もう一度生成してください。
              </Text>
            </View>
          ) : ready ? (
            <VideoView style={styles.player} player={player} nativeControls contentFit="contain" />
          ) : null}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.actions}>
        <Pressable
          style={[styles.shareBtn, (useDemo || missingVideo || sharing) && styles.btnDisabled]}
          disabled={useDemo || missingVideo || sharing}
          onPress={() => void onShare()}
          accessibilityRole="button"
          accessibilityLabel="Vlogを動画ファイルとして共有"
        >
          <LinearGradient
            pointerEvents="none"
            colors={[MINT, PURPLE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {sharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="share-outline" size={20} color="#fff" />
          )}
          <Text style={styles.shareTxt}>{sharing ? '動画を準備中…' : '動画を共有'}</Text>
        </Pressable>

        <Pressable
          style={[styles.saveBtn, (useDemo || missingVideo || saving) && styles.btnDisabled]}
          disabled={useDemo || missingVideo || saving || saved}
          onPress={() => void onSave()}
          accessibilityRole="button"
          accessibilityLabel="Vlogをカメラロールに保存"
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name={saved ? 'checkmark-circle' : 'download-outline'} size={19} color={saved ? MINT : '#fff'} />
          )}
          <Text style={[styles.saveTxt, saved && { color: MINT }]}>
            {saving ? '保存中…' : saved ? 'カメラロールに保存しました' : 'カメラロールに保存'}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#161222' },
  bgAura: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgAuraMint: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(85,224,180,0.16)',
  },
  bgAuraPurple: {
    position: 'absolute',
    bottom: 40,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(127,92,255,0.2)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headCenter: { flex: 1, alignItems: 'center', gap: 1 },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.55)',
  },
  title: { fontSize: 17, fontWeight: '900', color: '#fff' },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroAuraWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  heroGlow: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
  },
  heroOrbit: { position: 'absolute', width: 82, height: 82, borderRadius: 41 },
  orbitDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowColor: '#fff',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  orbitDotSmall: { width: 5, height: 5, borderRadius: 3 },
  heroCopy: { flex: 1, gap: 3 },
  heroLead: { fontSize: 16, fontWeight: '900', color: '#fff' },
  heroSub: { fontSize: 12, fontWeight: '700', lineHeight: 17, color: 'rgba(255,255,255,0.66)' },
  demoNotice: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  demoNoticeTxt: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    color: 'rgba(255,255,255,0.85)',
  },
  playerFrame: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 2,
    overflow: 'hidden',
    shadowColor: PURPLE,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  playerWrap: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  player: { flex: 1 },
  missingVideo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  missingVideoTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  shareBtn: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 16,
    shadowColor: MINT,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  shareTxt: { fontSize: 16, fontWeight: '900', color: '#fff' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  saveTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.55 },
})
