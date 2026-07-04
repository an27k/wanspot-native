import { useEffect, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { BackHandler, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { ListEnterItem } from '@/components/common/ListEnterItem'
import { PressableScale } from '@/components/common/PressableScale'
import { AiPlanLegDisplay } from '@/components/ai-plan/AiPlanLegDisplay'
import { AiPlanResultAd } from '@/components/ai-plan/AiPlanResultAd'
import { AiPlanRouteMap } from '@/components/ai-plan/AiPlanRouteMap'
import { AiPlanSpotCard } from '@/components/ai-plan/AiPlanSpotCard'
import { AiPlanSummaryCard } from '@/components/ai-plan/AiPlanSummaryCard'
import { AiPlanTimelineNode } from '@/components/ai-plan/AiPlanTimelineNode'
import type { AiPlanCore, AiPlanLeg, AiPlanMood, AiPlanStop, AiPlanTravelMode } from '@/components/ai-plan/types'
import { TOKENS } from '@/constants/color-tokens'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { openSpotDetailFromPlace } from '@/lib/open-spot-detail'
import { fetchSpotPhotoRefFromDetail, resolveSpotPhotoUri } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

/** タブ内表示のためネイティブ pop ジェスチャの対象外 — iOS は左端スワイプで onBack を再現 */
const IOS_EDGE_BACK_WIDTH = 24
const IOS_EDGE_SWIPE_DX = 56

type SpotRow = {
  id: string
  place_id: string | null
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

function placeFromAiPlanStop(stop: AiPlanStop, row: SpotRow | null): PlaceResult {
  return {
    place_id: row?.place_id ?? stop.spot_id,
    name: stop.name ?? row?.name ?? 'スポット',
    category: stop.category ?? row?.category ?? '',
    address: row?.address ?? '',
    lat: typeof row?.lat === 'number' ? row.lat : stop.lat ?? 0,
    lng: typeof row?.lng === 'number' ? row.lng : stop.lng ?? 0,
    photo_ref: row?.photo_ref ?? null,
    rating: row?.rating ?? null,
    price_level: row?.price_level ?? null,
    price_label: null,
    user_ratings_total: null,
  }
}

export function AiPlanResult({
  plan,
  legs,
  travelMode,
  mood,
  onBack,
  onPressNew,
}: {
  plan: AiPlanCore
  planId?: string | null
  legs: Record<number, AiPlanLeg>
  travelMode: AiPlanTravelMode
  mood: AiPlanMood | undefined
  onBack: () => void
  onPressNew: () => void
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const stops = plan.stops
  const [spotById, setSpotById] = useState<Record<string, SpotRow>>({})

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack()
      return true
    })
    return () => sub.remove()
  }, [onBack])

  const edgePan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Platform.OS === 'ios' &&
          g.numberActiveTouches === 1 &&
          g.dx > 10 &&
          Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          if (
            Platform.OS === 'ios' &&
            g.dx > IOS_EDGE_SWIPE_DX &&
            Math.abs(g.dx) > Math.abs(g.dy)
          ) {
            onBack()
          }
        },
      }),
    [onBack]
  )

  useEffect(() => {
    const ids = stops.map((s) => s.spot_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('spots')
        .select(
          'id, place_id, name, address, category, lat, lng, photo_ref, rating, price_level, google_types, extended_category'
        )
        .in('id', ids)
      const map: Record<string, SpotRow> = {}
      for (const row of (data ?? []) as SpotRow[]) {
        if (row?.id) map[row.id] = row
      }
      if (cancelled) return
      // 1段階目: DB の情報を即描画（名前・住所・評価・既存写真）
      setSpotById({ ...map })

      // 2段階目: DB の photo_ref は Google 側で期限切れになりやすい → Detail API で最新 ref に差し替え
      await Promise.all(
        Object.entries(map).map(async ([spotId, row]) => {
          const pid = row.place_id
          if (typeof pid !== 'string' || pid.length === 0) return
          const freshRef = await fetchSpotPhotoRefFromDetail(pid)
          if (freshRef) map[spotId] = { ...row, photo_ref: freshRef }
        })
      )
      if (cancelled) return
      setSpotById({ ...map })
    })()
    return () => {
      cancelled = true
    }
  }, [stops])

  useEffect(() => {
    const rows = Object.values(spotById)
    if (rows.length === 0) return
    const urls = stops
      .map((s) => {
        const row = spotById[s.spot_id]
        return resolveSpotPhotoUri(row?.photo_ref ?? null, s.photo_url ?? null, 'card')
      })
      .filter((u): u is string => u != null && u.length > 0)
    if (urls.length === 0) return
    void Image.prefetch(urls, 'memory-disk')
  }, [spotById, stops])

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

  return (
    <View style={styles.wrap}>
      {/* タブ内のため RN Stack のスワイプ pop は効かない — 左端ストリップで同等の戻りを実装 */}
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <AiPlanRouteMap stops={mergedStops} />

        <AiPlanSummaryCard plan={plan} legs={legs} mood={mood} travelMode={travelMode} />

        <AiPlanResultAd />

        <View style={styles.timeline}>
          {mergedStops.map((stop, i) => (
            <ListEnterItem key={stop.spot_id} index={i} animate>
              <AiPlanTimelineNode index={i} isLast={i === mergedStops.length - 1}>
                <AiPlanSpotCard
                  stop={stop}
                  db={spotById[stop.spot_id] ?? null}
                  onPress={() => {
                    const row = spotById[stop.spot_id] ?? null
                    openSpotDetailFromPlace(router, placeFromAiPlanStop(stop, row), stop.spot_id)
                  }}
                />
              </AiPlanTimelineNode>
              {i < mergedStops.length - 1 ? <AiPlanLegDisplay leg={legs[i] ?? null} mode={travelMode} /> : null}
            </ListEnterItem>
          ))}
        </View>

        <PressableScale style={styles.cta} onPress={onPressNew} accessibilityLabel="別のプランを作る">
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={styles.ctaTxt}>別のプランを作る</Text>
        </PressableScale>

        <Pressable onPress={onBack} style={styles.backLink} hitSlop={8} accessibilityRole="button">
          <Text style={styles.backLinkTxt}>一覧に戻る</Text>
        </Pressable>
      </ScrollView>

      {/* マップ上に浮かせた戻るボタン（Instagram 系の円形フローティング） */}
      <Pressable onPress={onBack} style={styles.floatBack} hitSlop={8} accessibilityLabel="戻る" accessibilityRole="button">
        <Ionicons name="chevron-back" size={20} color={TOKENS.text.primary} />
      </Pressable>

      {Platform.OS === 'ios' ? (
        <View
          style={styles.edgeBackStrip}
          collapsable={false}
          {...edgePan.panHandlers}
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  edgeBackStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: IOS_EDGE_BACK_WIDTH,
    zIndex: 10,
  },
  root: {
    flex: 1,
    backgroundColor: TOKENS.surface.secondary,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  floatBack: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 11,
  },
  timeline: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 0,
  },
  cta: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: TOKENS.brand.primary,
    borderRadius: 999,
    height: 52,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TOKENS.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  backLinkTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.text.secondary,
  },
})
