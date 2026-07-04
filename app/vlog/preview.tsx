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
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { TOKENS } from '@/constants/color-tokens'
import { GRADIENT_VLOG_LIQUID } from '@/constants/gradients'
import { REVIEW_TUTORIAL_SAMPLE_VLOG } from '@/lib/review/sample-vlog-video'
import { saveVlogToCameraRoll, shareVlogFile } from '@/lib/vlog/share'
import { track } from '@/lib/analytics'

const PREVIEW_RADIUS = 22
const LIQUID_GLOW = 'rgba(157,139,242,0.25)'

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Phase 5c — きょうのVlog 最終確認 */
export default function VlogPreviewScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ uri?: string; demo?: string; song?: string; regenerate?: string }>()
  const useDemo = params.demo === '1'
  const remoteUri = typeof params.uri === 'string' ? params.uri : null
  const songLabel = typeof params.song === 'string' && params.song.trim() ? params.song.trim() : 'BGM'
  const missingVideo = !useDemo && !remoteUri

  const [ready, setReady] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)

  const checkScale = useSharedValue(0)

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
        setPlaying(true)
      } catch {
        /* ignore */
      }
    }, 120)
    return () => clearTimeout(t)
  }, [ready, player])

  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => {
      try {
        setCurrentSec(player.currentTime ?? 0)
        setDurationSec(player.duration ?? 0)
      } catch {
        /* ignore */
      }
    }, 250)
    return () => clearInterval(id)
  }, [ready, player])

  useEffect(() => {
    if (!saved) return
    checkScale.value = withSpring(1, { damping: 12, stiffness: 180 })
  }, [saved, checkScale])

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }))

  const progress = durationSec > 0 ? Math.min(1, currentSec / durationSec) : 0

  const onTogglePlay = () => {
    try {
      if (playing) {
        player.pause()
        setPlaying(false)
      } else {
        player.play()
        setPlaying(true)
      }
    } catch {
      /* ignore */
    }
  }

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

  const onRegenerate = () => {
    router.back()
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headBtn} accessibilityLabel="閉じる">
          <Text style={styles.headBtnTxt}>✕</Text>
        </Pressable>
        <Text style={styles.headTitle}>きょうのVlog</Text>
        <Pressable onPress={onRegenerate} hitSlop={8} style={styles.headBtn} accessibilityLabel="作り直す">
          <Text style={styles.headRegen}>作り直す</Text>
        </Pressable>
      </View>

      <View style={styles.previewOuter}>
        <View style={styles.previewGlow}>
          <View style={styles.previewFrame}>
            {missingVideo ? (
              <View style={styles.missingVideo}>
                <Ionicons name="alert-circle-outline" size={28} color={TOKENS.surface.primary} />
                <Text style={styles.missingVideoTxt}>生成済みVlogのURLがありません</Text>
              </View>
            ) : ready ? (
              <>
                <VideoView style={styles.player} player={player} contentFit="cover" nativeControls={false} />
                <View style={styles.musicPill}>
                  <Text style={styles.musicPillTxt} numberOfLines={1}>
                    ♪ {songLabel} · {formatTime(durationSec || 24)}
                  </Text>
                </View>
                <View style={styles.seekRow}>
                  <Pressable onPress={onTogglePlay} style={styles.playBtn} accessibilityLabel={playing ? '一時停止' : '再生'}>
                    <Ionicons name={playing ? 'pause' : 'play'} size={18} color={TOKENS.surface.primary} />
                  </Pressable>
                  <View style={styles.seekTrack}>
                    <View style={[styles.seekFillWrap, { width: `${Math.round(progress * 100)}%` as `${number}%` }]}>
                      <LinearGradient colors={[...GRADIENT_VLOG_LIQUID]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    </View>
                  </View>
                  <Text style={styles.timeTxt}>
                    {formatTime(currentSec)}/{formatTime(durationSec)}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.shareBtn, (useDemo || missingVideo || sharing) && styles.btnDisabled]}
          disabled={useDemo || missingVideo || sharing}
          onPress={() => void onShare()}
          accessibilityRole="button"
          accessibilityLabel="SNSで共有"
        >
          {sharing ? (
            <ActivityIndicator color={TOKENS.surface.primary} />
          ) : (
            <Text style={styles.shareBtnTxt}>↗ SNSで共有</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.saveBtn, (useDemo || missingVideo || saving) && styles.btnDisabled]}
          disabled={useDemo || missingVideo || saving || saved}
          onPress={() => void onSave()}
          accessibilityRole="button"
          accessibilityLabel="カメラロールに保存"
        >
          {saving ? (
            <ActivityIndicator color={TOKENS.surface.primary} size="small" />
          ) : saved ? (
            <Animated.View entering={FadeIn} style={styles.savedRow}>
              <Animated.View style={checkStyle}>
                <Ionicons name="checkmark-circle" size={20} color={GRADIENT_VLOG_LIQUID[0]} />
              </Animated.View>
              <Text style={styles.saveBtnTxtDone}>保存しました</Text>
            </Animated.View>
          ) : (
            <Text style={styles.saveBtnTxt}>↓ カメラロールに保存</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.brand.vessel },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  headBtnTxt: { fontSize: 20, fontWeight: '600', color: TOKENS.surface.primary },
  headTitle: { fontSize: 16, fontWeight: '800', color: TOKENS.surface.primary },
  headRegen: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.72)', textAlign: 'right' },
  previewOuter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  previewGlow: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 9 / 16,
    borderRadius: PREVIEW_RADIUS + 4,
    shadowColor: LIQUID_GLOW,
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  previewFrame: {
    flex: 1,
    borderRadius: PREVIEW_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  player: { ...StyleSheet.absoluteFillObject },
  musicPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: '78%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  musicPillTxt: { fontSize: 11, fontWeight: '700', color: TOKENS.surface.primary },
  seekRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  seekFillWrap: { height: 5, borderRadius: 3, overflow: 'hidden' },
  timeTxt: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)', minWidth: 52, textAlign: 'right' },
  missingVideo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  missingVideoTxt: {
    color: TOKENS.surface.primary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  shareBtn: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: TOKENS.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TOKENS.brand.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  shareBtnTxt: { fontSize: 16, fontWeight: '800', color: TOKENS.surface.primary },
  saveBtn: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnTxt: { fontSize: 14, fontWeight: '800', color: TOKENS.surface.primary },
  saveBtnTxtDone: { fontSize: 14, fontWeight: '800', color: GRADIENT_VLOG_LIQUID[0] },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnDisabled: { opacity: 0.55 },
})
