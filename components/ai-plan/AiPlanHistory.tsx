import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
      <Pressable style={({ pressed }) => [styles.ctaCard, pressed && styles.ctaCardPressed]} onPress={onCreate}>
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
          <Text style={styles.emptyIcon}>🐾</Text>
          <Text style={styles.emptyTitle}>まだプランがありません</Text>
          <Text style={styles.emptyTxt}>上のボタンから新しいプランを作成しよう</Text>
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
              <Pressable
                key={r.id}
                onPress={() => onSelect(r)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{moodActive ? 'アクティブ' : 'のんびり'}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{travel === 'driving' ? '車' : '徒歩'}</Text>
                    </View>
                  </View>
                  <Text style={styles.date}>{fmtDate(r.created_at)}</Text>
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>
                  {title}
                </Text>

                <Text style={styles.areaLine} numberOfLines={1}>
                  {pref}
                  {muni ? ` ${muni}` : ''}
                </Text>

                <View style={styles.routeRow}>
                  <View style={styles.spotCountBadge}>
                    <Text style={styles.spotCountNum}>{spotCount}</Text>
                  </View>
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
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 32,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  ctaCardPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  ctaTextCol: { flex: 1 },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  ctaSub: {
    fontSize: 13,
    color: '#666',
  },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD54F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPlus: {
    color: '#1A1A1A',
    fontSize: 22,
    fontWeight: '900',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 4,
  },
  empty: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 26 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  emptyTxt: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  cardList: { gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 14,
    padding: 16,
  },
  cardPressed: { backgroundColor: '#FAFAF8', transform: [{ scale: 0.99 }] },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagRow: { flexDirection: 'row', gap: 6 },
  tag: { backgroundColor: '#F5F4F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 11, color: '#666', fontWeight: '700' },
  date: {
    fontSize: 11,
    color: '#999',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    lineHeight: 22,
    marginBottom: 8,
  },
  areaLine: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  spotCountBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotCountNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  routeSum: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
})
