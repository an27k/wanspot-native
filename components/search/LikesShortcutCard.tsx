import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { GoogleGlassPanel } from '@/components/search/GoogleGlassPanel'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { supabase } from '@/lib/supabase'
import { resolveSpotPhotoUri } from '@/lib/wanspot-api'

const THUMB_COUNT = 3

type LikesPreview = {
  count: number
  thumbs: { id: string; uri: string | null }[]
}

/**
 * 検索タブ中段の「いいねしたスポット」ショートカットカード。
 * 件数＋最新サムネイルを軽量クエリで表示し、タップでいいね一覧へ。
 */
export function LikesShortcutCard() {
  const router = useRouter()
  const [preview, setPreview] = useState<LikesPreview | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setPreview({ count: 0, thumbs: [] })
          return
        }
        const { data: likes } = await supabase
          .from('spot_likes')
          .select('spot_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        const ids = [...new Set((likes ?? []).map((r) => r.spot_id as string))]
        let thumbs: LikesPreview['thumbs'] = []
        if (ids.length > 0) {
          const headIds = ids.slice(0, THUMB_COUNT)
          const { data: spots } = await supabase
            .from('spots')
            .select('id, photo_ref')
            .in('id', headIds)
          const byId = new Map((spots ?? []).map((s) => [s.id as string, s.photo_ref as string | null]))
          thumbs = headIds.map((id) => ({
            id,
            uri: resolveSpotPhotoUri(byId.get(id) ?? null, null, 'thumbnail'),
          }))
        }
        if (!cancelled) setPreview({ count: ids.length, thumbs })
      })()
      return () => {
        cancelled = true
      }
    }, [])
  )

  const count = preview?.count ?? 0
  const thumbs = preview?.thumbs ?? []

  return (
    <GoogleGlassPanel onPress={() => router.push('/likes')} style={styles.shell}>
      <View style={styles.row}>
        <View style={styles.heartWrap}>
          <Ionicons name="heart" size={20} color="#FF8A7A" />
        </View>
        <View style={styles.bodyCol}>
          <Text style={styles.title}>いいねしたスポット</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {count > 0 ? `${count}件ストック中` : '気になるスポットを♡でストックしよう'}
          </Text>
        </View>
        {thumbs.length > 0 ? (
          <View style={styles.thumbRow}>
            {thumbs.map((t, i) =>
              t.uri ? (
                <Image
                  key={t.id}
                  source={{ uri: t.uri }}
                  style={[styles.thumb, { marginLeft: i === 0 ? 0 : -10, zIndex: THUMB_COUNT - i }]}
                  contentFit="cover"
                  recyclingKey={t.id}
                />
              ) : null
            )}
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={GOOGLE_HOME.textMuted} />
      </View>
    </GoogleGlassPanel>
  )
}

const styles = StyleSheet.create({
  shell: { marginBottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  heartWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,138,122,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyCol: { flex: 1, gap: 3, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, color: GOOGLE_HOME.textPrimary },
  sub: { fontSize: 13, fontWeight: '400', color: GOOGLE_HOME.textSecondary },
  thumbRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
})
