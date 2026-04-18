import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'
import type { AiPlanHistoryRow, AiPlanMood, AiPlanTravelMode } from '@/components/ai-plan/types'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function safeStr(x: unknown): string {
  return typeof x === 'string' ? x : ''
}

function routeSummary(stops: unknown): string {
  if (!Array.isArray(stops)) return ''
  const names = stops
    .slice(0, 3)
    .map((s) => (s && typeof s === 'object' && 'name' in s ? safeStr((s as { name?: unknown }).name) : ''))
    .filter(Boolean)
  return names.join(' → ')
}

function moodFromRow(row: AiPlanHistoryRow): AiPlanMood {
  const plan = row.generated_plan as { mood?: string } | undefined
  const fromPlan = safeStr(plan?.mood)
  const fromInput = safeStr((row.input_params as { mood?: string } | undefined)?.mood)
  const raw = fromPlan || fromInput
  return raw === 'relaxed' ? 'relaxed' : 'active'
}

function travelFromRow(row: AiPlanHistoryRow): AiPlanTravelMode {
  const plan = row.generated_plan as { travel_mode?: string } | undefined
  const fromPlan = safeStr(plan?.travel_mode)
  const fromInput = safeStr((row.input_params as { travel_mode?: string } | undefined)?.travel_mode)
  const raw = fromPlan || fromInput
  return raw === 'driving' ? 'driving' : 'walking'
}

export function AiPlanHistory({
  rows,
  onSelect,
  onCreate,
}: {
  rows: AiPlanHistoryRow[]
  onSelect: (row: AiPlanHistoryRow) => void
  onCreate: () => void
}) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable style={styles.ctaCard} onPress={onCreate}>
        <View style={styles.ctaTextCol}>
          <Text style={styles.ctaTitle}>新しいプランを作る</Text>
          <Text style={styles.ctaSub}>エリアを選んで1分で完成</Text>
        </View>
        <View style={styles.ctaIcon}>
          <Text style={styles.ctaPlus}>＋</Text>
        </View>
      </Pressable>

      <Text style={styles.sectionLabel}>最近のプラン</Text>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>まだプランがありません</Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {rows.map((r) => {
            const plan = r.generated_plan
            const title = safeStr(plan?.title) || 'AIプラン'
            const pref = safeStr(plan?.prefecture) || safeStr((r.input_params as { prefecture?: string })?.prefecture)
            const muni = safeStr(plan?.municipality) || safeStr((r.input_params as { municipality?: string })?.municipality)
            const stops = plan?.stops
            const spotCount = Array.isArray(stops) ? stops.length : 0
            const summary = routeSummary(stops)
            const mood = moodFromRow(r)
            const travel = travelFromRow(r)
            const moodActive = mood === 'active'

            return (
              <Pressable key={r.id} style={styles.card} onPress={() => onSelect(r)}>
                <View style={styles.cardTop}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.moodBadge, moodActive ? styles.moodOn : styles.moodOff]}>
                      <Text style={[styles.moodBadgeTxt, moodActive ? styles.moodTxtOn : styles.moodTxtOff]}>
                        {moodActive ? 'アクティブ' : 'のんびり'}
                      </Text>
                    </View>
                    <View style={[styles.travelBadge]}>
                      <Text style={styles.travelBadgeTxt}>{travel === 'driving' ? '車' : '徒歩'}</Text>
                    </View>
                    <Text style={styles.date}>{fmtDate(r.created_at)}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.areaLine} numberOfLines={1}>
                    {pref}
                    {muni ? ` ${muni}` : ''}
                  </Text>
                </View>
                <View style={styles.cardBottom}>
                  <View style={styles.spotCountCircle}>
                    <Text style={styles.spotCountNum}>{spotCount}</Text>
                  </View>
                  <Text style={styles.spotLabel}>スポット</Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.routeSum} numberOfLines={1}>
                    {summary || '—'}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.surface.secondary },
  content: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 28,
  },
  ctaCard: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaTextCol: { flex: 1 },
  ctaTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.text.primary,
    marginBottom: 1,
  },
  ctaSub: {
    fontSize: 10,
    color: TOKENS.text.tertiary,
  },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.brand.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPlus: {
    color: TOKENS.text.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.text.tertiary,
    letterSpacing: 1.28,
    textTransform: 'uppercase',
    marginTop: 6,
    marginLeft: 4,
  },
  empty: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyTxt: {
    fontSize: 12,
    color: TOKENS.text.tertiary,
    fontWeight: '600',
  },
  cardList: { gap: 10 },
  card: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardTop: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 6,
  },
  moodBadge: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  moodOn: { backgroundColor: TOKENS.brand.yellow },
  moodOff: { backgroundColor: TOKENS.surface.alt },
  moodBadgeTxt: { fontSize: 9 },
  moodTxtOn: { color: TOKENS.text.primary, fontWeight: '800' },
  moodTxtOff: { color: TOKENS.text.secondary, fontWeight: '700' },
  travelBadge: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    backgroundColor: TOKENS.surface.alt,
  },
  travelBadgeTxt: {
    fontSize: 9,
    fontWeight: '700',
    color: TOKENS.text.secondary,
  },
  date: {
    fontSize: 10,
    color: TOKENS.text.meta,
    marginLeft: 'auto',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.text.primary,
    lineHeight: 18,
    marginBottom: 3,
  },
  areaLine: {
    fontSize: 10,
    color: TOKENS.text.tertiary,
  },
  cardBottom: {
    backgroundColor: TOKENS.surface.tertiary,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border.subtle,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spotCountCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: TOKENS.brand.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotCountNum: {
    fontSize: 8,
    fontWeight: '800',
    color: TOKENS.text.primary,
  },
  spotLabel: {
    fontSize: 10,
    color: TOKENS.text.secondary,
  },
  dot: {
    fontSize: 10,
    color: TOKENS.text.hint,
  },
  routeSum: {
    flex: 1,
    fontSize: 10,
    color: TOKENS.text.secondary,
  },
})
