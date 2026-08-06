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
import { TutorialVideoFallback } from '@/components/album/TutorialSampleVideo'
import { colors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { track } from '@/lib/analytics'
import { markReviewTutorialSeen } from '@/lib/review/tutorial-storage'

type Props = {
  visible: boolean
  onClose: () => void
  dogName?: string | null
}

const STEPS = [
  {
    icon: 'paw' as const,
    title: 'おでかけ',
    body: 'スポット詳細で「行った」を押して、レビューの素材を集める',
  },
  {
    icon: 'star' as const,
    title: 'レビュー',
    body: '写真・動画を2枚以上つけると1スポット分。1枚なら半分たまる',
  },
  {
    icon: 'film' as const,
    title: '5スポットでVLOG',
    body: '5スポットぶんレビューが溜まると、自動でVLOGが完成する',
  },
]

export function ReviewTutorialModal({ visible, onClose, dogName }: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [page, setPage] = useState(0)

  const displayDogName = dogName?.trim() || '愛犬'
  const mainCopy = `おでかけを5スポットぶんレビューすると、${displayDogName}のVLOGが自動でできあがるよ🐶`
  const subCopy = '写真・動画を2枚以上つけると1スポット分。多いほどVLOGが豊かになるよ'

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
              {/* サンプル動画は差し替え予定のため一時的に非表示。TutorialSampleVideo/moka_vlog_sample.mp4を
                  実際のVLOG品質のクリップに更新したら、ここをTutorialSampleVideoに戻す */}
              <View style={styles.videoSlot}>
                <TutorialVideoFallback />
              </View>
              <Text style={styles.lead}>{mainCopy}</Text>
              <Text style={styles.leadSub}>{subCopy}</Text>
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
              <Text style={styles.finalTitle}>最初の1スポットからはじめよう</Text>
              <Text style={styles.finalBody}>
                スポット詳細で「行った」→ レビュータブで写真・動画を2枚以上追加
              </Text>
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
  skip: { ...type.button, color: colors.textSecondary },
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
  lead: {
    ...type.heading,
    color: colors.textPrimary,
    textAlign: 'center' as const,
  },
  leadSub: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center' as const,
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
  stepTitle: { ...type.heading, color: colors.textPrimary },
  stepBody: { ...type.body, color: colors.textSecondary },
  final: { alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  finalTitle: { ...type.heading, color: colors.textPrimary, textAlign: 'center' as const },
  finalBody: { ...type.body, color: colors.textSecondary, textAlign: 'center' as const },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.primary, width: 20 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaTxt: { ...type.button, color: '#fff' },
})
