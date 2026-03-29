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
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { UiIconChevronLeft, UiIconSort } from '@/components/ui-icons'
import { SpotListCard } from '@/components/SpotListCard'
import { RunningDog } from '@/components/DogStates'
import { IconPaw } from '@/components/IconPaw'
import { fetchCheckedInSpotsForUser, type UserSpotRow } from '@/lib/fetch-user-spot-lists'
import { supabase } from '@/lib/supabase'
import {
  sortUserSpotRows,
  type PlaceCardEnrichment,
  type UserSpotSortKey,
} from '@/lib/user-spot-list-utils'
import { wanspotFetch } from '@/lib/wanspot-api'
import { TAB_BAR_HEIGHT } from '@/constants/layout'

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
  const [spots, setSpots] = useState<UserSpotRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<UserSpotSortKey>('date_desc')
  const [showSort, setShowSort] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [enrichment, setEnrichment] = useState<Record<string, PlaceCardEnrichment>>({})

  useEffect(() => {
    void Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return
      void Location.getCurrentPositionAsync({}).then((pos) =>
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      )
    })
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

  const padTop = Math.max(12, insets.top)
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <View style={[styles.screen, styles.center]}>
        <RunningDog label="行った一覧を読み込み中..." />
      </View>
    )
  }

  if (loadState === 'redirect') {
    return <View style={styles.screen} />
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: padTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="戻る">
          <UiIconChevronLeft size={22} />
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <IconPaw size={18} color="#1a1a1a" />
            <Text style={styles.h1}>行った</Text>
            <Text style={styles.count}>（累計 {loadState === 'success' ? spots.length : '—'}）</Text>
          </View>
          {loadState === 'success' && spots.length > 0 ? (
            <TouchableOpacity style={styles.sortPill} onPress={() => setShowSort(true)}>
              <UiIconSort />
              <Text style={styles.sortPillTxt}>{currentSort.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
          <View style={styles.empty}>
            <IconPaw size={40} color="#aaa" />
            <Text style={styles.emptyTxt}>まだ行ったスポットがありません</Text>
          </View>
        ) : null}
        {loadState === 'success' &&
          sortedSpots.map((spot) => (
            <SpotListCard
              key={spot.id}
              row={spot}
              enrichment={enrichment[spot.place_id]}
              userLocation={userLocation}
              heartMode="toggle"
              onOpen={() => router.push(`/spots/${spot.id}`)}
            />
          ))}
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
                  <Text style={[styles.sortLineTxt, disabled && { color: '#ddd' }]}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f6f3' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { marginBottom: 4, alignSelf: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  h1: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  count: { fontSize: 14, fontWeight: '700', color: '#aaa' },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
  },
  sortPillTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  errBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  errTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  errBody: { fontSize: 12, color: '#888', marginBottom: 12 },
  retry: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
  },
  retryTxt: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyTxt: { fontSize: 14, fontWeight: '700', color: '#aaa', textAlign: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', padding: 24 },
  sortSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
    overflow: 'hidden',
  },
  sortLine: { paddingVertical: 12, paddingHorizontal: 16 },
  sortLineOn: { backgroundColor: '#FFF9E0' },
  sortLineTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
})
