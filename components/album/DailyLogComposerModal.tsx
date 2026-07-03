import { useEffect, useState } from 'react'
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TOKENS } from '@/constants/color-tokens'
import {
  DAILY_LOG_CONTEXTS,
  DAILY_LOG_MOODS,
  contextLabel,
  type DailyLogContext,
  type DailyLogMood,
} from '@/lib/daily-log'
import {
  captureDailyLogMedia,
  pickDailyLogMedia,
  type PickedDailyLogMedia,
} from '@/lib/image-picker'
import { track } from '@/lib/analytics'
import {
  formatVisitRecordError,
  insertMemory,
  recordDailyLog,
  uploadMemoryFile,
} from '@/lib/visits-memories'

type Props = {
  userId: string
  dogName: string
  visible: boolean
  /** エントリカードでタップされたコンテキスト */
  initialContext: DailyLogContext
  onClose: () => void
  onSaved: () => void
}

/**
 * きょうのログ クイック記録 (P3) — 超軽量の記録UI。
 * 入力は「コンテキスト + メディア1点（写真 or カメラ撮影の短い動画）+ 気分スタンプ（任意）」だけ。
 * 同日・同コンテキストは同じ visits 行に memories が追記される（lib/visits-memories.recordDailyLog）。
 */
export function DailyLogComposerModal({
  userId,
  dogName,
  visible,
  initialContext,
  onClose,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets()
  const [context, setContext] = useState<DailyLogContext>(initialContext)
  const [media, setMedia] = useState<PickedDailyLogMedia | null>(null)
  const [mood, setMood] = useState<DailyLogMood | null>(null)
  const [saving, setSaving] = useState(false)

  // 開き直し時にエントリカードで選ばれたコンテキストへリセット
  useEffect(() => {
    if (visible) {
      setContext(initialContext)
      setMedia(null)
      setMood(null)
    }
  }, [visible, initialContext])

  const capture = async () => {
    const item = await captureDailyLogMedia()
    if (item) setMedia(item)
  }

  const pick = async () => {
    const item = await pickDailyLogMedia()
    if (item) setMedia(item)
  }

  const canSave = media != null && !saving

  const save = async () => {
    // 多重タップ対策: 既存 MemoryComposerModal と同じ saving ガード
    if (saving || !media) return
    setSaving(true)
    try {
      const recorded = await recordDailyLog(userId, context, mood)
      if (!recorded.ok || !recorded.visitId) {
        Alert.alert(
          '記録に失敗しました',
          recorded.error ? formatVisitRecordError(recorded.error) : '時間をおいて再度お試しください。'
        )
        return
      }

      const uploaded = await uploadMemoryFile(userId, media.uri, media.mimeType)
      if (!uploaded.ok) {
        Alert.alert('保存に失敗しました', '写真・動画を保存できませんでした。時間をおいて再度お試しください。')
        return
      }

      const { row, error } = await insertMemory({
        userId,
        visitId: recorded.visitId,
        spotId: null,
        storagePath: uploaded.path,
        mediaType: uploaded.mediaType,
      })
      if (!row) {
        Alert.alert(
          '保存に失敗しました',
          error ? formatVisitRecordError(error) : '時間をおいて再度お試しください。'
        )
        return
      }

      track('daily_log_saved', {
        context,
        has_mood: mood != null,
        media_type: uploaded.mediaType,
        created_visit: recorded.created === true,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const isVideo = media?.mimeType.startsWith('video/') ?? false

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={saving ? undefined : onClose}>
      <Pressable style={styles.bg} onPress={saving ? undefined : onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]} onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={styles.headCopy}>
              <Text style={styles.kicker}>DAILY LOG</Text>
              <Text style={styles.title}>きょうの{dogName}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} disabled={saving} accessibilityLabel="閉じる">
              <Ionicons name="close" size={24} color={TOKENS.text.primary} />
            </Pressable>
          </View>

          <View style={styles.chipRow}>
            {DAILY_LOG_CONTEXTS.map((ctx) => {
              const on = ctx.id === context
              return (
                <Pressable
                  key={ctx.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setContext(ctx.id)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`${ctx.label}に切り替え`}
                >
                  <Ionicons
                    name={ctx.icon as keyof typeof Ionicons.glyphMap}
                    size={13}
                    color={on ? '#fff' : TOKENS.brand.pillText}
                  />
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{ctx.label}</Text>
                </Pressable>
              )
            })}
          </View>

          {media ? (
            <View style={styles.previewWrap}>
              {isVideo ? (
                <View style={[styles.preview, styles.previewVideo]}>
                  <Ionicons name="play-circle" size={34} color="#fff" />
                  <Text style={styles.previewVideoTxt}>動画</Text>
                </View>
              ) : (
                <Image source={{ uri: media.uri }} style={styles.preview} contentFit="cover" />
              )}
              <Pressable
                style={styles.previewRemove}
                onPress={() => setMedia(null)}
                hitSlop={6}
                disabled={saving}
                accessibilityLabel="選んだメディアを外す"
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.mediaRow}>
              <Pressable style={styles.mediaBtn} onPress={() => void capture()} disabled={saving}>
                <View style={styles.mediaBtnOrb}>
                  <Ionicons name="camera" size={22} color="#fff" />
                </View>
                <Text style={styles.mediaBtnTxt}>カメラ</Text>
                <Text style={styles.mediaBtnSub}>写真 or 10秒動画</Text>
              </Pressable>
              <Pressable style={styles.mediaBtn} onPress={() => void pick()} disabled={saving}>
                <View style={[styles.mediaBtnOrb, styles.mediaBtnOrbAlt]}>
                  <Ionicons name="images" size={22} color={TOKENS.brand.pillText} />
                </View>
                <Text style={styles.mediaBtnTxt}>ライブラリ</Text>
                <Text style={styles.mediaBtnSub}>1点えらぶ</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.moodRow}>
            {DAILY_LOG_MOODS.map((m) => {
              const on = m.id === mood
              return (
                <Pressable
                  key={m.id}
                  style={[styles.mood, on && styles.moodOn]}
                  onPress={() => setMood(on ? null : m.id)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`気分: ${m.label}`}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodTxt, on && styles.moodTxtOn]}>{m.label}</Text>
                </Pressable>
              )
            })}
          </View>

          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            disabled={!canSave}
            onPress={() => void save()}
            accessibilityRole="button"
            accessibilityLabel="きょうのログを保存"
          >
            <Text style={[styles.saveBtnTxt, !canSave && styles.saveBtnTxtDisabled]}>
              {saving ? '保存中...' : `${contextLabel(context)}をのこす`}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 14,
    backgroundColor: TOKENS.surface.paper,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: TOKENS.border.emphasis,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headCopy: { flex: 1, gap: 1 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: TOKENS.text.meta },
  title: { fontSize: 19, fontWeight: '900', color: TOKENS.text.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: TOKENS.brand.tintWeak,
    borderWidth: 1,
    borderColor: TOKENS.brand.tintStrong,
  },
  chipOn: {
    backgroundColor: TOKENS.brand.primary,
    borderColor: TOKENS.brand.primary,
  },
  chipTxt: { fontSize: 12, fontWeight: '900', color: TOKENS.brand.pillText },
  chipTxtOn: { color: '#fff' },
  mediaRow: { flexDirection: 'row', gap: 10 },
  mediaBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingVertical: 16,
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  mediaBtnOrb: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.brand.primary,
    marginBottom: 2,
  },
  mediaBtnOrbAlt: { backgroundColor: TOKENS.brand.tintWeak },
  mediaBtnTxt: { fontSize: 13, fontWeight: '900', color: TOKENS.text.primary },
  mediaBtnSub: { fontSize: 10, fontWeight: '700', color: TOKENS.text.secondary },
  previewWrap: { position: 'relative', alignSelf: 'center' },
  preview: {
    width: 148,
    height: 148,
    borderRadius: 20,
    backgroundColor: TOKENS.surface.alt,
  },
  previewVideo: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: TOKENS.text.primary,
  },
  previewVideoTxt: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
  previewRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  mood: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderRadius: 14,
    paddingVertical: 8,
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  moodOn: {
    backgroundColor: TOKENS.brand.tintWeak,
    borderColor: TOKENS.brand.primary,
  },
  moodEmoji: { fontSize: 18 },
  moodTxt: { fontSize: 9, fontWeight: '800', color: TOKENS.text.secondary },
  moodTxtOn: { color: TOKENS.brand.pillText },
  saveBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: TOKENS.brand.primary,
    shadowColor: TOKENS.brand.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  saveBtnDisabled: { backgroundColor: TOKENS.border.emphasis, shadowOpacity: 0, elevation: 0 },
  saveBtnTxt: { fontSize: 15, fontWeight: '900', color: '#fff' },
  saveBtnTxtDisabled: { color: TOKENS.text.tertiary },
})
