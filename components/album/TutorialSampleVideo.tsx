import { useEffect, useRef, useState } from 'react'
import { InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { type } from '@/constants/typography'
import { REVIEW_TUTORIAL_SAMPLE_VLOG } from '@/lib/review/sample-vlog-video'
import { DISABLE_TUTORIAL_VIDEO } from '@/lib/debug/review-crash-flags'

type Props = {
  onFailed: () => void
}

/** チュートリアル用サンプル動画 — player は1つ・mount 後に再生・unmount で停止 */
export function TutorialSampleVideo({ onFailed }: Props) {
  const onFailedRef = useRef(onFailed)
  onFailedRef.current = onFailed
  const [failed, setFailed] = useState(false)
  const [playbackReady, setPlaybackReady] = useState(false)

  const player = useVideoPlayer(REVIEW_TUTORIAL_SAMPLE_VLOG, (p) => {
    p.loop = true
    p.muted = true
  })

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setPlaybackReady(true)
    })
    return () => task.cancel()
  }, [])

  useEffect(() => {
    if (!playbackReady || failed) return

    let cancelled = false
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' && !cancelled) {
        console.warn('[TutorialSampleVideo]', error?.message ?? 'load failed')
        setFailed(true)
        onFailedRef.current()
      }
    })

    const playTimer = setTimeout(() => {
      if (cancelled) return
      try {
        player.play()
      } catch (e) {
        console.warn('[TutorialSampleVideo] play failed', e)
        setFailed(true)
        onFailedRef.current()
      }
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(playTimer)
      sub.remove()
      try {
        player.pause()
      } catch {
        // player may already be released
      }
    }
  }, [failed, playbackReady, player])

  if (DISABLE_TUTORIAL_VIDEO || failed || !playbackReady) return null

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={() => {
        try {
          player.muted = !player.muted
        } catch {
          // ignore
        }
      }}
      accessibilityLabel="サンプルVLOGを再生"
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </Pressable>
  )
}

export function TutorialVideoFallback() {
  return (
    <View style={styles.fallback}>
      <Ionicons name="film-outline" size={44} color="rgba(255,255,255,0.92)" />
      <Text style={styles.fallbackTxt}>おでかけの記録がVLOGに</Text>
      <Text style={styles.fallbackSubTxt}>あなたと愛犬の思い出が動画になるよ</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 20 },
  fallbackTxt: { ...type.heading, color: '#fff', textAlign: 'center' },
  fallbackSubTxt: { ...type.caption, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
})
