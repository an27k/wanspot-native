import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { InteractionManager, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { REVIEW_TUTORIAL_SAMPLE_VLOG } from '@/lib/review/sample-vlog-video'

/** Phase 5 — プレビュー / OS共有シート（透かし無し） */
export default function VlogPreviewScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ uri?: string; demo?: string }>()
  const useDemo = params.demo === '1' || !params.uri
  const remoteUri = typeof params.uri === 'string' ? params.uri : null

  const [ready, setReady] = useState(false)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true))
    return () => task.cancel()
  }, [])

  const source = useMemo(
    () => (useDemo ? REVIEW_TUTORIAL_SAMPLE_VLOG : { uri: remoteUri! }),
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
    if (remoteUri && !useDemo) {
      await Share.share({ message: 'wanspotでVLOGを作ったよ 🐾', url: remoteUri })
      return
    }
    await Share.share({ message: 'wanspotでVLOGを作ったよ 🐾' })
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>今月のVLOG</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.playerWrap}>
        {ready ? (
          <VideoView style={styles.player} player={player} nativeControls contentFit="contain" />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.shareBtn} onPress={() => void onShare()}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.shareTxt}>共有</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  playerWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  player: { flex: 1 },
  actions: { paddingHorizontal: 16, paddingTop: 16 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
  },
  shareTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
})
