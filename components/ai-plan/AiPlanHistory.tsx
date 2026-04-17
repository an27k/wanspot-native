import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { AiPlanHistoryRow } from '@/components/ai-plan/types'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function safeStr(x: any): string {
  return typeof x === 'string' ? x : ''
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
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
      <View style={styles.head}>
        <Text style={styles.h}>最近のプラン</Text>
        <Text style={styles.hint}>保存されたプランはここから開けます。</Text>
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>まだプランがありません</Text>
          <Pressable style={styles.btn} onPress={onCreate}>
            <Text style={styles.btnTxt}>新しいプランを作る</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((r) => {
            const plan = r.generated_plan
            const title = safeStr(plan?.title) || 'AIプラン'
            const pref = safeStr(plan?.prefecture) || safeStr(r.input_params?.prefecture)
            const muni = safeStr(plan?.municipality) || safeStr(r.input_params?.municipality)
            const mood = safeStr(plan?.mood) || safeStr(r.input_params?.mood)
            return (
              <Pressable key={r.id} style={styles.row} onPress={() => onSelect(r)}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {fmtDate(r.created_at)}  {pref} {muni}  {mood}
                </Text>
              </Pressable>
            )
          })}

          <Pressable style={styles.btn} onPress={onCreate}>
            <Text style={styles.btnTxt}>新しいプランを作る</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  head: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', padding: 14, gap: 6 },
  h: { fontSize: 16, fontWeight: '900', color: '#1a1a1a' },
  hint: { fontSize: 12, color: '#888' },
  row: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', padding: 14, gap: 6 },
  rowTitle: { fontSize: 14, fontWeight: '900', color: '#1a1a1a' },
  rowMeta: { fontSize: 11, fontWeight: '700', color: '#888' },
  empty: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', padding: 16, gap: 12, alignItems: 'center' },
  emptyTxt: { fontSize: 13, fontWeight: '800', color: '#888' },
  btn: { borderRadius: 16, backgroundColor: '#FFD84D', paddingVertical: 14, alignItems: 'center' },
  btnTxt: { fontSize: 14, fontWeight: '900', color: '#1a1a1a' },
})
