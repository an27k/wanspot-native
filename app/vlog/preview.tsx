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
  const useDemo = params.demo === '1'
  const remoteUri = typeof params.uri === 'string' ? params.uri : null
  const missingVideo = !useDemo && !remoteUri

  const [ready, setReady] = useState(false)
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
        <Text style={styles.title}>{useDemo ? 'サンプルVLOG' : '今月のVLOG'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {useDemo ? (
        <View style={styles.demoNotice}>
          <Ionicons name="information-circle-outline" size={17} color="#8A5A00" />
          <Text style={styles.demoNoticeTxt}>
            これはサンプルです。あなたの写真・動画から作るVlog生成は準備中です。
          </Text>
        </View>
      ) : null}

      <View style={styles.playerWrap}>
        {missingVideo ? (
          <View style={styles.missingVideo}>
            <Ionicons name="alert-circle-outline" size={28} color="#fff" />
            <Text style={styles.missingVideoTxt}>生成済みVlogのURLがありません。もう一度生成してください。</Text>
          </View>
        ) : ready ? (
          <VideoView style={styles.player} player={player} nativeControls contentFit="contain" />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.shareBtn, useDemo && styles.shareBtnDisabled]} onPress={() => void onShare()}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.shareTxt}>{useDemo ? 'サンプルを共有' : '共有'}</Text>
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
  demoNotice: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: '#FFF7DB',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  demoNoticeTxt: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17, color: '#8A5A00' },
  playerWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  player: { flex: 1 },
  missingVideo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  missingVideoTxt: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: 'center' },
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
  shareBtnDisabled: {
    backgroundColor: '#B9B2AA',
  },
  shareTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
})
