import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DogAlertFace } from '@/components/map/DogAlertFace'
import { WalkAlertGauge } from '@/components/map/WalkAlertGauge'
import { breedHeatSensitivity } from '@/lib/dog-breeds'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import {
  WALK_ALERT_LEVELS,
  walkAlertFromTemp,
  walkAlertLevel,
  type WalkAlertLevel,
} from '@/lib/weather/walk-alert'
import type { WalkDailyAdvice } from '@/lib/weather/walk-daily-advice'
import { WALK_TIME_CHOICES } from '@/lib/weather/walk-time-pref'
import type { WeatherCondition } from '@/lib/weather/fetch-weather'

function weatherAwareLabel(levelLabel: string, condition: WeatherCondition | null | undefined): string {
  switch (condition) {
    case 'rain':
      return '雨注意'
    case 'thunder':
      return '雷雨注意'
    case 'snow':
      return '雪注意'
    case 'wind':
      return '強風注意'
    default:
      return levelLabel
  }
}

export function WalkAlertModal({
  visible,
  tempC,
  currentCondition = null,
  loading = false,
  needsLocation = false,
  onRequestLocation,
  onClose,
  dailyAdvice = null,
  adviceLoading = false,
  walkLine = null,
  walkTimeHour = null,
  onChangeWalkTimeHour,
  dogBreed = null,
}: {
  visible: boolean
  tempC: number | null
  currentCondition?: WeatherCondition | null
  loading?: boolean
  needsLocation?: boolean
  onRequestLocation?: () => void
  onClose: () => void
  dailyAdvice?: WalkDailyAdvice | null
  adviceLoading?: boolean
  /** 「今日は何を変えるか」の一言。出ない日が通常なので null が既定 */
  walkLine?: string | null
  /** いつものお散歩時間（通知時刻の基準）。onChange を渡すと設定UIを表示する */
  walkTimeHour?: number | null
  onChangeWalkTimeHour?: (hour: number | null) => void
  /** 短頭種など暑さに弱い犬種は閾値を下げる */
  dogBreed?: string | null
}) {
  const [guideExpanded, setGuideExpanded] = useState(false)
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  // 湿度・体感補正後のレベル（advice側）があれば優先し、本文とバッジのトーンを一致させる
  const level: WalkAlertLevel | null = dailyAdvice?.levelKey
    ? walkAlertLevel(dailyAdvice.levelKey)
    : tempC == null
      ? null
      : walkAlertFromTemp(tempC, { heatSensitivity: breedHeatSensitivity(dogBreed) })

  const emptyMessage = needsLocation
    ? 'お散歩予報は「位置情報」の許可で現在地の気温を取得します（別の許可項目はありません）。下のボタンで許可を確認してください。'
    : loading
      ? '気温を取得しています…'
      : '気温を取得できませんでした。通信環境を確認して、しばらくお待ちください。'

  const adviceText = dailyAdvice?.text ?? level?.advice ?? ''
  const adviceDate = dailyAdvice?.dateLabel
  const adviceArea = dailyAdvice?.areaLabel
  const metaLine = [adviceDate, adviceArea].filter(Boolean).join(' · ')

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.kicker}>お散歩アラート</Text>

          {/* 閉じるボタンを常に押せる位置に残すため、本文だけをスクロールさせる */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {level ? (
              <>
                <View style={styles.headerRow}>
                  <View style={styles.headerLeft}>
                    <View style={styles.miniGauge}>
                      <WalkAlertGauge
                        size={34}
                        color={colors.paper}
                        ringColor={level.color}
                        iconColor={level.color}
                        tempC={tempC}
                        filled
                      />
                    </View>
                    <Text style={styles.headerStatus}>
                      <Text style={[styles.levelInline, { color: level.color }]}>
                        {weatherAwareLabel(level.label, currentCondition)}
                      </Text>
                      {tempC != null ? (
                        <Text style={styles.tempInline}> · 現在{tempC}℃</Text>
                      ) : null}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.guideToggle}
                    onPress={() => setGuideExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: guideExpanded }}
                  >
                    <Text style={styles.guideToggleTxt}>温度ガイド</Text>
                    <Ionicons
                      name={guideExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>

                {metaLine ? <Text style={styles.metaLine}>{metaLine}</Text> : null}

                {guideExpanded ? (
                  <View style={styles.inlineGuide}>
                    {WALK_ALERT_LEVELS.map((lv) => {
                      const active = lv.key === level.key
                      return (
                        <View
                          key={lv.key}
                          style={[styles.scaleRow, active && styles.scaleRowOn, active && { borderColor: lv.color }]}
                        >
                          <DogAlertFace size={26} level={lv.key} ringColor={lv.color} />
                          <View style={styles.scaleTextCol}>
                            <Text style={[styles.scaleLabel, active && { color: lv.color }]}>{lv.label}</Text>
                            <Text style={styles.scaleRange}>{lv.rangeLabel}</Text>
                          </View>
                          {active ? <View style={[styles.activeDot, { backgroundColor: lv.color }]} /> : null}
                        </View>
                      )
                    })}
                  </View>
                ) : null}

                <View style={styles.adviceBox}>
                  {adviceLoading && !dailyAdvice ? (
                    <View style={styles.adviceLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.adviceLoadingTxt}>今日の散歩アドバイスを作成中…</Text>
                    </View>
                  ) : (
                    <Text style={styles.advice}>{adviceText}</Text>
                  )}
                </View>

                {/* カードに出ている一言をここでも見せる。開いたら消えるのは不自然なので */}
                {walkLine ? (
                  <View style={styles.walkLineBox}>
                    <Text style={styles.walkLineTxt}>{walkLine}</Text>
                  </View>
                ) : null}

                {onChangeWalkTimeHour ? (
                  <View style={styles.walkTimeSection}>
                    <Text style={styles.walkTimeTitle}>いつものお散歩時間</Text>
                    <Text style={styles.walkTimeHint}>
                      設定すると、その2時間前に予定時間の予報と歩きやすい時間の目安をお届けします（未設定は朝5時）。
                    </Text>
                    <View style={styles.walkTimeChips}>
                      {WALK_TIME_CHOICES.map((c) => {
                        const on = walkTimeHour === c.hour
                        return (
                          <Pressable
                            key={c.label}
                            style={[styles.walkTimeChip, on && styles.walkTimeChipOn]}
                            onPress={() => onChangeWalkTimeHour(c.hour)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                          >
                            <Text style={[styles.walkTimeChipTxt, on && styles.walkTimeChipTxtOn]}>{c.label}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                ) : null}

                <Text style={styles.disclaimer}>
                  気象データにもとづく目安です。うちの子の様子をいちばんに判断してあげてください。
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.noData}>{emptyMessage}</Text>
                {needsLocation && onRequestLocation ? (
                  <Pressable style={styles.locationBtn} onPress={onRequestLocation}>
                    <Text style={styles.locationBtnTxt}>位置情報を許可する</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeTxt}>閉じる</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    // 警告文が長い日や温度ガイド展開時に画面を超えても、閉じるボタンを画面内に残す
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  kicker: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // RN の flexShrink 既定値は 0。明示しないと本文が縮まず閉じるボタンを押し出す
  scrollArea: { flexShrink: 1, flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
  headerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  miniGauge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerStatus: { flex: 1, flexShrink: 1 },
  levelInline: { ...type.title },
  tempInline: { ...type.button, color: colors.textSecondary },
  guideToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingLeft: 8 },
  guideToggleTxt: { ...type.label, color: colors.textMuted },
  metaLine: {
    ...type.caption,
    marginTop: 6,
    color: colors.textMuted,
  },
  inlineGuide: { marginTop: 10, gap: 6 },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scaleRowOn: {
    backgroundColor: colors.tintWeak,
    borderColor: colors.primary,
  },
  scaleTextCol: { flex: 1, gap: 1 },
  // 温度ガイドは7段階の一覧。太字を並べると自分の段階を探しにくいので、行はウェイト400に落として色で示す
  scaleLabel: { ...type.row, color: colors.textSecondary },
  scaleRange: { ...type.caption, color: colors.textMuted },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  adviceBox: {
    marginTop: 12,
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 88,
  },
  advice: { ...type.body, color: colors.text },
  walkTimeSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  walkTimeTitle: { ...type.heading, color: colors.textPrimary },
  walkTimeHint: { ...type.caption, color: colors.textMuted },
  walkTimeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  walkTimeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  walkTimeChipOn: { borderColor: colors.primary, backgroundColor: colors.tintWeak },
  walkTimeChipTxt: { ...type.label, color: colors.textSecondary },
  walkTimeChipTxtOn: { color: colors.primary },
  disclaimer: {
    ...type.caption,
    marginTop: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  adviceLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  walkLineBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  walkLineTxt: { ...type.body, color: colors.textPrimary },
  adviceLoadingTxt: { ...type.caption, color: colors.textMuted },
  // 位置情報の説明文が入る箇所。読ませる文章なので本文サイズ
  noData: { ...type.body, marginTop: 16, color: colors.textSecondary },
  locationBtn: {
    marginTop: 16,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  locationBtnTxt: { ...type.button, color: colors.onPrimary },
  closeBtn: {
    marginTop: 16,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
  },
  closeTxt: { ...type.button, color: colors.textInverse },
})
