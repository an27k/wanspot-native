import { useCallback, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'
import { track } from '@/lib/analytics'
import { markReviewTutorialSeen } from '@/lib/review/tutorial-storage'

type Props = {
  visible: boolean
  onClose: () => void
}

const STEPS = [
  {
    icon: 'paw' as const,
    title: 'おでかけ',
    body: '行ったスポットがレビューの素材になる',
  },
  {
    icon: 'star' as const,
    title: 'レビュー',
    body: 'コメントや写真・動画を残す',
  },
  {
    icon: 'film' as const,
    title: '5スポットでVLOG',
    body: 'レビューが溜まると自動でVLOG完成',
  },
]

export function ReviewTutorialModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [page, setPage] = useState(0)

  const finish = useCallback(
    async (event: 'tutorial_skip' | 'tutorial_complete') => {
      track(event)
      await markReviewTutorialSeen()
      onClose()
      setPage(0)
    },
    [onClose]
  )

  const onSkip = () => {
    void finish('tutorial_skip')
  }

  const onComplete = () => {
    track('first_review')
    void finish('tutorial_complete')
    router.push('/(tabs)/search')
  }

  if (!visible) return null

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onSkip}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.head}>
          <Pressable onPress={onSkip} hitSlop={12}>
            <Text style={styles.skip}>スキップ</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {page === 0 ? (
            <>
              <View style={styles.videoSlot}>
                <View style={styles.videoFallback}>
                  <Ionicons name="play-circle" size={56} color="#fff" />
                  <Text style={styles.videoFallbackTxt}>サンプルVLOGプレビュー</Text>
                  <Text style={styles.videoHint}>assets/review/sample-vlog.mp4 を差し替え</Text>
                </View>
              </View>
              <Text style={styles.lead}>5スポットのレビューで、こんなVLOGが手に入る</Text>
            </>
          ) : null}

          {page === 1 ? (
            <View style={styles.steps}>
              {STEPS.map((s) => (
                <View key={s.title} style={styles.stepRow}>
                  <View style={styles.stepIcon}>
                    <Ionicons name={s.icon} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.stepText}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepBody}>{s.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {page === 2 ? (
            <View style={styles.final}>
              <Ionicons name="search" size={48} color={colors.primary} />
              <Text style={styles.finalTitle}>最初の1スポットをレビューしよう</Text>
              <Text style={styles.finalBody}>スポット詳細で「行った」→ レビューや写真を追加</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, page === i && styles.dotOn]} />
          ))}
        </View>

        <Pressable
          style={styles.cta}
          onPress={() => {
            if (page < 2) {
              setPage((p) => p + 1)
              return
            }
            onComplete()
          }}
        >
          <Text style={styles.ctaTxt}>{page < 2 ? '次へ' : 'スポットを探す'}</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 20 },
  head: { alignItems: 'flex-end', marginBottom: 8 },
  skip: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  body: { flexGrow: 1, justifyContent: 'center', gap: 20, paddingVertical: 12 },
  videoSlot: {
    aspectRatio: 9 / 16,
    maxHeight: 360,
    alignSelf: 'center',
    width: '72%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.vessel,
  },
  videoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  videoFallbackTxt: { fontSize: 15, fontWeight: '800', color: '#fff', textAlign: 'center' },
  videoHint: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  lead: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 26,
  },
  steps: { gap: 16 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tintWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, gap: 4 },
  stepTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  stepBody: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, lineHeight: 20 },
  final: { alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  finalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  finalBody: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.primary, width: 20 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
})
