import { useEffect, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SafeRemoteImage } from '@/components/common/SafeRemoteImage'
import { TOKENS } from '@/constants/color-tokens'
import { type } from '@/constants/typography'
import {
  DAILY_LOG_CONTEXTS,
  contextLabel,
  moodEmoji,
  todaysDailyLogPlates,
  type DailyLogContext,
} from '@/lib/daily-log'
import type { VisitPlate } from '@/lib/visits-memories'

type Props = {
  dogName: string
  plates: VisitPlate[]
  /** コンテキストチップ or「＋ついか」タップでクイック記録を開く */
  onRecord: (context: DailyLogContext) => void
  /** 当日の記録サムネイルタップで詳細を開く */
  onOpenPlate: (plate: VisitPlate) => void
}

/** アイコンの浮遊アニメーション（単色のまま、v8 restraint準拠） */
function FloatingPawOrb() {
  const float = useSharedValue(0)

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [float])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 5 }, { scale: 1 + float.value * 0.04 }],
    shadowOpacity: 0.22 + float.value * 0.14,
  }))

  return (
    <Animated.View style={[styles.orb, style]}>
      <Ionicons name="paw" size={22} color="#fff" />
    </Animated.View>
  )
}

/**
 * きょうのログ (P3) — アルバムタブ先頭の常設エントリ。
 * 未記録: コンテキストチップ5種で即クイック記録へ。
 * 記録済み: 当日のサムネ + 気分スタンプ + 「＋ついか」（1日に何度でも追記できる）。
 */
export function DailyLogEntryCard({ dogName, plates, onRecord, onOpenPlate }: Props) {
  const todayPlates = useMemo(() => todaysDailyLogPlates(plates), [plates])
  const hasToday = todayPlates.length > 0

  return (
    <Animated.View entering={FadeInDown.duration(240)} style={styles.card}>
      <View style={styles.head}>
        <FloatingPawOrb />
        <View style={styles.headCopy}>
          <Text style={styles.kicker}>DAILY LOG</Text>
          <Text style={styles.title}>
            {hasToday ? `きょうの${dogName}、いい感じ` : `きょうの${dogName}をのこそう`}
          </Text>
          <Text style={styles.sub}>
            {hasToday
              ? 'きょうの記録はアルバムとVlog素材に入りました。何度でも追記できます。'
              : '写真1枚か短い動画だけでOK。そのままVlog素材になります。'}
          </Text>
        </View>
      </View>

      {hasToday ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.todayRow}>
          {todayPlates.map((plate) => {
            const cover = plate.memories[0]
            const emoji = moodEmoji(plate.mood)
            return (
              <Pressable
                key={plate.id}
                style={styles.todayThumbWrap}
                onPress={() => onOpenPlate(plate)}
                accessibilityRole="button"
                accessibilityLabel={`きょうの${contextLabel(plate.context)}の記録を開く`}
              >
                {cover?.thumbSignedUrl ? (
                  <SafeRemoteImage
                    uri={cover.thumbSignedUrl}
                    style={styles.todayThumb}
                    contentFit="cover"
                    recyclingKey={cover.id}
                    fallback={<View style={[styles.todayThumb, styles.todayThumbPlaceholder]} />}
                  />
                ) : (
                  <View style={[styles.todayThumb, styles.todayThumbPlaceholder]}>
                    <Ionicons name="paw" size={18} color={TOKENS.text.meta} />
                  </View>
                )}
                {emoji ? (
                  <View style={styles.todayMood}>
                    <Text style={styles.todayMoodTxt}>{emoji}</Text>
                  </View>
                ) : null}
                <View style={styles.todayLabel}>
                  <Text style={styles.todayLabelTxt} numberOfLines={1}>
                    {contextLabel(plate.context)}
                  </Text>
                </View>
              </Pressable>
            )
          })}
          <Pressable
            style={styles.todayAdd}
            onPress={() => onRecord('walk')}
            accessibilityRole="button"
            accessibilityLabel="きょうのログを追加する"
          >
            <Ionicons name="add" size={22} color={TOKENS.brand.primary} />
            <Text style={styles.todayAddTxt}>ついか</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <View style={styles.chipRow}>
        {DAILY_LOG_CONTEXTS.map((ctx) => (
          <Pressable
            key={ctx.id}
            style={styles.chip}
            onPress={() => onRecord(ctx.id)}
            accessibilityRole="button"
            accessibilityLabel={`${ctx.label}を記録する`}
          >
            <Ionicons name={ctx.icon as keyof typeof Ionicons.glyphMap} size={13} color={TOKENS.brand.pillText} />
            <Text style={styles.chipTxt}>{ctx.label}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    shadowColor: TOKENS.brand.primary,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orb: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.brand.primary,
    shadowColor: TOKENS.brand.primary,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  headCopy: { flex: 1, gap: 2 },
  kicker: {
    ...type.label,
    color: TOKENS.text.meta,
  },
  title: { ...type.heading, color: TOKENS.text.primary },
  sub: { ...type.caption, color: TOKENS.text.secondary },
  todayRow: { gap: 10, paddingVertical: 2 },
  todayThumbWrap: { position: 'relative' },
  todayThumb: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: TOKENS.surface.alt,
  },
  todayThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayMood: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  // 絵文字。26×26 の丸に収めるアイコンなので文字の型は当てない
  todayMoodTxt: { fontSize: 13 },
  todayLabel: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 8,
    paddingVertical: 2,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  todayLabelTxt: { ...type.label, color: '#fff' },
  todayAdd: {
    width: 76,
    height: 76,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: TOKENS.brand.tintStrong,
    backgroundColor: TOKENS.brand.tintWeak,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  todayAddTxt: { ...type.label, color: TOKENS.brand.pillText },
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
  chipTxt: { ...type.label, color: TOKENS.brand.pillText },
})
