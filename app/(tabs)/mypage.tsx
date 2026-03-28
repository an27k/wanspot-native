import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/AppHeader'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'

export default function MypageTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()
  const [dogName, setDogName] = useState('—')
  const [ownerName, setOwnerName] = useState('—')
  const [parentType, setParentType] = useState<string | null>(null)
  const [likes, setLikes] = useState(0)
  const [checkins, setCheckins] = useState(0)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('users').select('name, parent_type').eq('id', user.id).maybeSingle()
    setOwnerName(prof?.name ?? user.email?.split('@')[0] ?? '—')
    setParentType(prof?.parent_type ?? null)
    const { data: dog } = await supabase.from('dogs').select('name').eq('user_id', user.id).limit(1).maybeSingle()
    setDogName(dog?.name ?? '未登録')
    const { count: lc } = await supabase
      .from('spot_likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    const { count: cc } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    setLikes(lc ?? 0)
    setCheckins(cc ?? 0)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: padBottom }}>
        <Text style={styles.section}>オーナー</Text>
        <Text style={styles.value}>{ownerName}</Text>
        {parentType ? (
          <Text style={styles.sub}>{parentType === 'papa' ? 'パパ' : parentType === 'mama' ? 'ママ' : parentType}</Text>
        ) : null}
        <Text style={styles.section}>愛犬</Text>
        <Text style={styles.value}>{dogName}</Text>
        <Text style={styles.section}>STATS</Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{likes}</Text>
            <Text style={styles.statLbl}>いいね</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{checkins}</Text>
            <Text style={styles.statLbl}>行った</Text>
          </View>
        </View>
        <Pressable style={styles.row} onPress={() => router.push('/likes')}>
          <Text style={styles.rowTxt}>いいね一覧</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push('/checkins')}>
          <Text style={styles.rowTxt}>行った一覧</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push('/mypage/events')}>
          <Text style={styles.rowTxt}>主催イベント管理</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push('/onboarding/dog')}>
          <Text style={styles.rowTxt}>犬プロフィールを編集</Text>
        </Pressable>
        <Pressable style={[styles.row, styles.logout]} onPress={() => signOut()}>
          <Text style={styles.logoutTxt}>ログアウト</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  section: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginTop: 16, marginBottom: 6 },
  value: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.textLight, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statNum: { fontSize: 22, fontWeight: '900', color: colors.text },
  statLbl: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  row: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTxt: { fontWeight: '700', color: colors.text, fontSize: 15 },
  logout: { borderColor: colors.error },
  logoutTxt: { fontWeight: '700', color: colors.error, fontSize: 15 },
})
