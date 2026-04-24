import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { AiPlanInsuranceBanner } from '@/components/ai-plan/AiPlanInsuranceBanner'
import { AiPlanLegDisplay } from '@/components/ai-plan/AiPlanLegDisplay'
import { AiPlanRouteMap } from '@/components/ai-plan/AiPlanRouteMap'
import { AiPlanSpotCard } from '@/components/ai-plan/AiPlanSpotCard'
import { AiPlanSummaryCard } from '@/components/ai-plan/AiPlanSummaryCard'
import { AiPlanTimelineNode } from '@/components/ai-plan/AiPlanTimelineNode'
import type { AiPlanCore, AiPlanLeg, AiPlanMood, AiPlanStop, AiPlanTravelMode } from '@/components/ai-plan/types'
import { TOKENS } from '@/constants/color-tokens'

type SpotRow = {
  id: string
  lat: number | null
  lng: number | null
  name: string | null
  address: string | null
  category: string | null
  photo_ref: string | null
  rating: number | null
  price_level: number | null
  google_types: string[] | null
  extended_category: string | null
}

export function AiPlanResult({
  plan,
  legs,
  travelMode,
  mood,
  planId,
  onBack,
  onPressNew,
  onMore,
}: {
  plan: AiPlanCore
  planId?: string | null
  legs: Record<number, AiPlanLeg>
  travelMode: AiPlanTravelMode
  mood: AiPlanMood | undefined
  onBack: () => void
  onPressNew: () => void
  onMore?: () => void
}) {
  const router = useRouter()
  const stops = plan.stops
  const [spotById, setSpotById] = useState<Record<string, SpotRow>>({})

  useEffect(() => {
    const ids = stops.map((s) => s.spot_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
    if (ids.length === 0) return
    void (async () => {
      const { data } = await supabase
        .from('spots')
        .select(
          'id, name, address, category, lat, lng, photo_ref, rating, price_level, google_types, extended_category'
        )
        .in('id', ids)
      const map: Record<string, SpotRow> = {}
      for (const row of (data ?? []) as SpotRow[]) {
        if (row?.id) map[row.id] = row
      }
      setSpotById(map)
    })()
  }, [stops])

  const mergedStops: AiPlanStop[] = useMemo(() => {
    return stops.map((s) => {
      const row = spotById[s.spot_id]
      return {
        ...s,
        lat: typeof row?.lat === 'number' ? row.lat : s.lat,
        lng: typeof row?.lng === 'number' ? row.lng : s.lng,
        google_types: row?.google_types ?? s.google_types,
        extended_category: row?.extended_category ?? s.extended_category,
      }
    })
  }, [stops, spotById])

  const handleMore = () => {
    if (onMore) onMore()
    // eslint-disable-next-line no-console -- プレースホルダ
    console.log('[AiPlanResult] more')
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      {/* タブ内のため通常はスタックの OS 戻るは出ないが、親ナビの設定によっては重なる場合あり */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerBack} hitSlop={8}>
          <Text style={styles.headerBackTxt}>← 戻る</Text>
        </Pressable>
        <Pressable onPress={handleMore} style={styles.headerMore} hitSlop={8}>
          <Text style={styles.headerMoreTxt}>⋯</Text>
        </Pressable>
      </View>

      <AiPlanRouteMap stops={mergedStops} />

      <AiPlanSummaryCard plan={plan} legs={legs} mood={mood} travelMode={travelMode} />

      <AiPlanInsuranceBanner planId={planId} />

      <View style={styles.timeline}>
        {mergedStops.map((stop, i) => (
          <View key={stop.spot_id}>
            <AiPlanTimelineNode index={i} isLast={i === mergedStops.length - 1}>
              <AiPlanSpotCard
                stop={stop}
                db={spotById[stop.spot_id] ?? null}
                onPress={() => router.push(`/spots/${stop.spot_id}`)}
              />
            </AiPlanTimelineNode>
            {i < mergedStops.length - 1 ? <AiPlanLegDisplay leg={legs[i] ?? null} mode={travelMode} /> : null}
          </View>
        ))}
      </View>

      <Pressable style={styles.cta} onPress={onPressNew}>
        <Text style={styles.ctaTxt}>別のプランを作る</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: TOKENS.surface.secondary,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border.subtle,
    backgroundColor: TOKENS.surface.primary,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBackTxt: {
    fontSize: 16,
    color: TOKENS.text.primary,
    fontWeight: '600',
  },
  headerMore: {
    paddingHorizontal: 4,
  },
  headerMoreTxt: {
    fontSize: 14,
    color: TOKENS.text.secondary,
    fontWeight: '600',
  },
  timeline: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 0,
  },
  cta: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: TOKENS.brand.yellow,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.text.primary,
  },
})
