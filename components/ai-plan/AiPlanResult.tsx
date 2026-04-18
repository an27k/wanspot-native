import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import type { AiPlanCore, AiPlanLeg, AiPlanStop, AiPlanTravelMode } from '@/components/ai-plan/types'
import { AiPlanLegDisplay } from '@/components/ai-plan/AiPlanLegDisplay'
import { AiPlanSpotCard } from '@/components/ai-plan/AiPlanSpotCard'

type SpotPhotoRow = { id: string; photo_ref: string | null }

export function AiPlanResult({
  plan,
  legs,
  travelMode,
  onPressNew,
}: {
  plan: AiPlanCore
  legs: Record<number, AiPlanLeg>
  travelMode: AiPlanTravelMode
  onPressNew: () => void
}) {
  const router = useRouter()
  const stops = plan.stops

  const [photoMap, setPhotoMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const ids = stops.map((s) => s.spot_id).filter(Boolean)
    if (ids.length === 0) return
    void (async () => {
      const { data } = await supabase.from('spots').select('id, photo_ref').in('id', ids)
      const map: Record<string, string | null> = {}
      for (const row of (data ?? []) as SpotPhotoRow[]) {
        map[row.id] = row.photo_ref ?? null
      }
      setPhotoMap(map)
    })()
  }, [stops])

  const timeline = useMemo(() => {
    const out: Array<{ kind: 'stop'; stop: AiPlanStop; idx: number } | { kind: 'leg'; idx: number }> = []
    for (let i = 0; i < stops.length; i++) {
      out.push({ kind: 'stop', stop: stops[i], idx: i })
      if (i < stops.length - 1) out.push({ kind: 'leg', idx: i })
    }
    return out
  }, [stops])

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}>
      <View style={styles.head}>
        <Text style={styles.title}>{plan.title}</Text>
        <Text style={styles.summary}>{plan.summary}</Text>
      </View>

      {timeline.map((item) => {
        if (item.kind === 'leg') {
          return <AiPlanLegDisplay key={`leg-${item.idx}`} leg={legs[item.idx] ?? null} mode={travelMode} />
        }
        const photoRef = photoMap[item.stop.spot_id] ?? null
        return (
          <AiPlanSpotCard
            key={item.stop.spot_id}
            stop={item.stop}
            photoRef={photoRef}
            delayMs={item.idx * 300}
            onPress={() => router.push(`/spots/${item.stop.spot_id}`)}
          />
        )
      })}

      <Pressable style={styles.btn} onPress={onPressNew}>
        <Text style={styles.btnTxt}>別のプランを作る</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  head: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', padding: 14, gap: 8 },
  title: { fontSize: 18, fontWeight: '900', color: '#2b2a28' },
  summary: { fontSize: 13, color: '#666', lineHeight: 19 },
  btn: { marginTop: 6, borderRadius: 16, backgroundColor: '#FFD84D', paddingVertical: 14, alignItems: 'center' },
  btnTxt: { fontSize: 14, fontWeight: '900', color: '#2b2a28' },
})
