import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { AppHeader } from '@/components/AppHeader'
import { UserSpotsListScreen } from '@/components/lists/UserSpotsListScreen'
import { RunningDog } from '@/components/DogStates'
import { IconPaw } from '@/components/IconPaw'
import { EmptyState } from '@/components/common/EmptyState'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { fetchCheckedInSpotsForUser, type UserSpotRow } from '@/lib/fetch-user-spot-lists'
import { supabase } from '@/lib/supabase'
import {
  sortUserSpotRows,
  type PlaceCardEnrichment,
  type UserSpotSortKey,
} from '@/lib/user-spot-list-utils'
import { openSpotDetailFromUserSpotRow } from '@/lib/open-spot-detail'
import { wanspotFetch } from '@/lib/wanspot-api'

const IconSort = ({ color }: { color: string }) => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
    <Path d="M3 6h18M3 12h12M3 18h6" />
  </Svg>
)

const SORT_OPTIONS: { key: UserSpotSortKey; label: string }[] = [
  { key: 'date_desc', label: '追加日（新しい順）' },
  { key: 'name', label: '名前順' },
  { key: 'distance', label: '距離順' },
  { key: 'rating', label: '評価順' },
  { key: 'likes', label: 'いいね数' },
]

type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'redirect'

export default function CheckinsPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const [spots, setSpots] = useState<UserSpotRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<UserSpotSortKey>('date_desc')
  const [showSort, setShowSort] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [enrichment, setEnrichment] = useState<Record<string, PlaceCardEnrichment>>({})

  useEffect(() => {
    // 屋内や GPS 不調で reject するため catch 必須（未処理の Promise 拒否になる）
    void Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== 'granted') return
        return Location.getCurrentPositionAsync({}).then((pos) =>
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (sortKey === 'distance' && !userLocation) setSortKey('date_desc')
  }, [sortKey, userLocation])

  const load = useCallback(async () => {
    setLoadState('loading')
    setErrorMessage(null)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) console.warn('[checkins] getUser', authError.message)
    if (!user) {
      setLoadState('redirect')
      router.replace('/(auth)/login')
      return
    }
    const result = await fetchCheckedInSpotsForUser(supabase, user.id)
    if (!result.ok) {
      setSpots([])
      setErrorMessage(result.error)
      setLoadState('error')
      return
    }
    setSpots(result.spots)
    setLoadState('success')
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const placeIds = [...new Set(spots.map((s) => s.place_id))]
    if (placeIds.length === 0) {
      setEnrichment({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await wanspotFetch('/api/spots/batch-details', {
          method: 'POST',
          json: { place_ids: placeIds },
        })
        const json = (await res.json()) as { details?: Record<string, PlaceCardEnrichment> }
        if (!cancelled && json.details) setEnrichment(json.details)
      } catch {
        if (!cancelled) setEnrichment({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [spots])

  const sortedSpots = useMemo(
    () => sortUserSpotRows(spots, sortKey, enrichment, userLocation),
    [spots, sortKey, enrichment, userLocation]
  )

  const currentSort = SORT_OPTIONS.find((o) => o.key === sortKey)!

  const padBottom = insets.bottom + 24

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <View style={styles.screen}>
        <AppHeader variant="back" onBack={() => router.back()} />
        <View style={styles.center}>
          <RunningDog label="行った一覧を読み込み中..." />
        </View>
      </View>
    )
  }

  if (loadState === 'redirect') {
    return <View style={styles.screen} />
  }

  return (
    <View style={styles.screen}>
      <AppHeader variant="back" onBack={() => router.back()} />
      <View style={styles.pageHeading}>
        <View style={styles.titleLeft}>
          <IconPaw size={18} color={colors.textPrimary} />
          <Text style={styles.h1}>行った</Text>
          <Text style={styles.count}>累計 {loadState === 'success' ? spots.length : '—'}</Text>
        </View>
        {loadState === 'success' && spots.length > 0 ? (
          <TouchableOpacity style={styles.sortPill} onPress={() => setShowSort(true)}>
            <IconSort color={colors.textInverse} />
            <Text style={styles.sortPillTxt}>{currentSort.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 12 }}>
        {loadState === 'error' ? (
          <View style={styles.errBox}>
            <Text style={styles.errTitle}>読み込みに失敗しました</Text>
            <Text style={styles.errBody}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retry} onPress={() => void load()}>
              <Text style={styles.retryTxt}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {loadState === 'success' && spots.length === 0 ? (
          <EmptyState
            icon={<IconPaw size={40} color={colors.textHint} />}
            title="まだ行ったスポットがありません"
            body="お散歩で立ち寄ったスポットに足あとをつけると、ここに記録されます。"
            actionLabel="スポットを探す"
            onAction={() => router.push('/(tabs)/search')}
          />
        ) : null}
        {loadState === 'success' ? (
          <UserSpotsListScreen
            spots={sortedSpots}
            enrichment={enrichment}
            userLocation={userLocation}
            heartMode="toggle"
            onOpenSpot={(id) => {
              const row = sortedSpots.find((s) => s.id === id)
              if (row) openSpotDetailFromUserSpotRow(router, row)
            }}
          />
        ) : null}
      </ScrollView>

      <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowSort(false)}>
          <View style={styles.sortSheet}>
            {SORT_OPTIONS.map((opt) => {
              const disabled = opt.key === 'distance' && !userLocation
              return (
                <TouchableOpacity
                  key={opt.key}
                  disabled={disabled}
                  style={[styles.sortLine, sortKey === opt.key && !disabled && styles.sortLineOn]}
                  onPress={() => {
                    if (disabled) return
                    setSortKey(opt.key)
                    setShowSort(false)
                  }}
                >
                  <Text style={[styles.sortLineTxt, disabled && styles.sortLineTxtDisabled]}>
                    {opt.label}
                    {sortKey === opt.key && !disabled ? ' ✓' : ''}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageHeading: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  // largeTitle(34) は並びの都合で使わない。ヘッダは1行に アイコン＋見出し＋累計＋並べ替えピル が同居する
  h1: { ...type.title, color: colors.textPrimary },
  count: { ...type.caption, color: colors.textMeta },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.textPrimary,
  },
  sortPillTxt: { ...type.label, color: colors.textInverse },
  errBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errTitle: { ...type.row, fontWeight: '700' as const, color: colors.textPrimary, marginBottom: 8 },
  errBody: { ...type.caption, color: colors.textSecondary, marginBottom: 12 },
  retry: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  retryTxt: { ...type.button, color: colors.onPrimary },
  modalBg: { flex: 1, backgroundColor: colors.overlayScrim, justifyContent: 'center', padding: 24 },
  sortSheet: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sortLine: { paddingVertical: 12, paddingHorizontal: 16 },
  sortLineOn: { backgroundColor: colors.tintStrong },
  sortLineTxt: { ...type.row, color: colors.textSecondary },
  sortLineTxtDisabled: { color: colors.textDisabled },
})
