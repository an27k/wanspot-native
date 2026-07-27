import { useCallback, useEffect, useRef } from 'react'
import { FlatList, StyleSheet, View, type ViewToken } from 'react-native'
import { NearbySheetSpotCard } from '@/components/nearby/NearbySheetSpotCard'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'

/** カード幅・カード間隔（snapToInterval / getItemLayout で共有する） */
const CARD_W = 300
const CARD_GAP = 12
const SNAP_INTERVAL = CARD_W + CARD_GAP
const SIDE_PAD = 16
/** onViewableItemsChanged 由来の選択に掛けるデバウンス（マップ追従との発振防止） */
const SELECT_DEBOUNCE_MS = 250

/**
 * 地図下の横スワイプカルーセル（ワンナビ型）。
 * - スワイプで中央に来たカードを onSelectSpot に流し、マップ側の追従アニメと同期する
 * - ピンタップなど外部からの選択は selectedKey 経由で受け取り、該当カードへスクロールする
 */
export function NearbySpotCarousel({
  items,
  selectedKey,
  userLocation,
  likedPlaceIds,
  onToggleLike,
  onPressSpot,
  onSelectSpot,
  bottomOffset,
}: {
  items: SheetSpot[]
  selectedKey: string | null
  userLocation: { lat: number; lng: number } | null
  likedPlaceIds: Set<string>
  onToggleLike: (spot: SheetSpot) => void
  onPressSpot: (spot: SheetSpot) => void
  onSelectSpot: (spot: SheetSpot) => void
  /** 画面下端からの配置オフセット（ピーク状態のシートの上に載せる） */
  bottomOffset: number
}) {
  const listRef = useRef<FlatList<SheetSpot>>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** カルーセル自身が発火した選択キー — ピンタップ由来と区別して再スクロールを抑える */
  const selfEmittedKeyRef = useRef<string | null>(null)
  /** ユーザーが実際にスワイプしたか。マウント直後の viewability で地図が先頭スポットへ
   *  飛んでしまい「現在地が中心にならない」状態になるのを防ぐ */
  const userScrolledRef = useRef(false)

  // onViewableItemsChanged は途中差し替え不可のため、可変値は ref 経由で参照する
  const selectedKeyRef = useRef(selectedKey)
  selectedKeyRef.current = selectedKey
  const onSelectSpotRef = useRef(onSelectSpot)
  onSelectSpotRef.current = onSelectSpot

  // ピンタップなど外部由来の選択 → 該当カードへスクロール
  useEffect(() => {
    if (!selectedKey) return
    if (selfEmittedKeyRef.current === selectedKey) {
      // 自分発の選択が戻ってきただけならスクロールしない（発振防止）
      selfEmittedKeyRef.current = null
      return
    }
    const idx = items.findIndex((s) => s.key === selectedKey)
    if (idx < 0) return
    listRef.current?.scrollToOffset({ offset: idx * SNAP_INTERVAL, animated: true })
  }, [selectedKey, items])

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return
      // 初期表示時の自動発火では選択しない（地図は現在地のままにする）
      if (!userScrolledRef.current) return
      // 見えている中の中央アイテムを選択候補にする
      const center = viewableItems[Math.floor(viewableItems.length / 2)]
      const spot = center?.item as SheetSpot | undefined
      if (!spot) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (spot.key === selectedKeyRef.current) return
        selfEmittedKeyRef.current = spot.key
        onSelectSpotRef.current(spot)
      }, SELECT_DEBOUNCE_MS)
    }
  ).current

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

  const getItemLayout = useCallback(
    (_: ArrayLike<SheetSpot> | null | undefined, index: number) => ({
      length: SNAP_INTERVAL,
      offset: SNAP_INTERVAL * index,
      index,
    }),
    []
  )

  const renderItem = useCallback(
    ({ item }: { item: SheetSpot }) => (
      <View style={styles.cardWrap}>
        <NearbySheetSpotCard
          spot={item}
          userLocation={userLocation}
          variant="carousel"
          onPress={() => onPressSpot(item)}
          liked={likedPlaceIds.has(item.placeId)}
          onToggleLike={() => onToggleLike(item)}
        />
      </View>
    ),
    [userLocation, likedPlaceIds, onPressSpot, onToggleLike]
  )

  if (items.length === 0) return null

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <FlatList
        ref={listRef}
        data={items}
        horizontal
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          userScrolledRef.current = true
        }}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.content}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9,
    elevation: 9,
  },
  content: { paddingHorizontal: SIDE_PAD },
  cardWrap: { width: CARD_W, marginRight: CARD_GAP },
})
