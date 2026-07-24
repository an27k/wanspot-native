import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DogAlertFace } from '@/components/map/DogAlertFace'
import { WalkAlertGauge } from '@/components/map/WalkAlertGauge'
import { colors } from '@/constants/colors'
import {
  WALK_ALERT_LEVELS,
  walkAlertFromTemp,
  walkAlertLevel,
  type WalkAlertLevel,
} from '@/lib/weather/walk-alert'
import type { WalkDailyAdvice } from '@/lib/weather/walk-daily-advice'
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
}) {
  const [guideExpanded, setGuideExpanded] = useState(false)
  // 湿度・体感補正後のレベル（advice側）があれば優先し、本文とバッジのトーンを一致させる
  const level: WalkAlertLevel | null = dailyAdvice?.levelKey
    ? walkAlertLevel(dailyAdvice.levelKey)
    : tempC == null
      ? null
      : walkAlertFromTemp(tempC)

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

          {level ? (
            <>
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <View style={styles.miniGauge}>
                    <WalkAlertGauge
                      size={34}
                      color={colors.background}
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
                    <ActivityIndicator size="small" color={colors.brandDark} />
                    <Text style={styles.adviceLoadingTxt}>今日の散歩アドバイスを作成中…</Text>
                  </View>
                ) : (
                  <Text style={styles.advice}>{adviceText}</Text>
                )}
              </View>

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

          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeTxt}>閉じる</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 42, 40, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
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
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerStatus: { flex: 1, flexShrink: 1 },
  levelInline: { fontSize: 17, fontWeight: '900' },
  tempInline: { fontSize: 15, fontWeight: '700', color: colors.textLight },
  guideToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingLeft: 8 },
  guideToggleTxt: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  metaLine: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scaleRowOn: {
    backgroundColor: '#FFFBF5',
    borderColor: colors.brand,
  },
  scaleTextCol: { flex: 1, gap: 1 },
  scaleLabel: { fontSize: 14, fontWeight: '800', color: colors.textLight },
  scaleRange: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  adviceBox: {
    marginTop: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 88,
  },
  advice: { fontSize: 16, lineHeight: 26, fontWeight: '600', color: colors.text },
  disclaimer: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
  },
  adviceLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  adviceLoadingTxt: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  noData: { marginTop: 16, fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.textLight },
  locationBtn: {
    marginTop: 16,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  locationBtnTxt: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  closeBtn: {
    marginTop: 16,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
  },
  closeTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
})
