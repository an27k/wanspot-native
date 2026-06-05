import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { NEARBY_DEFAULT_SHEET_INDEX } from '@/lib/nearby/constants'
import { NearbySheetSpotCard } from '@/components/nearby/NearbySheetSpotCard'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'

export type NearbySheetTab = 'score' | 'like' | 'visited'

export type NearbySheetHandle = {
  collapse: () => void
  expand: () => void
  scrollToSpot: (key: string) => void
}

type NearbyBottomSheetProps = {
  tab: NearbySheetTab
  items: SheetSpot[]
  userLocation: { lat: number; lng: number } | null
  loading: boolean
  emptyTitle: string
  emptyHint: string
  onDiscover: () => void
  onPressSpot: (spot: SheetSpot) => void
  likedPlaceIds: Set<string>
  onToggleLike: (spot: SheetSpot) => void
  onSheetPositionChange?: (bottomInset: number) => void
  onSheetIndexChange?: (index: number) => void
  animatedIndex?: SharedValue<number>
}

export const NearbyBottomSheet = forwardRef<NearbySheetHandle, NearbyBottomSheetProps>(
  function NearbyBottomSheet(
    {
      tab,
      items,
      userLocation,
      loading,
      emptyTitle,
      emptyHint,
      onDiscover,
      onPressSpot,
      likedPlaceIds,
      onToggleLike,
      onSheetPositionChange,
      onSheetIndexChange,
      animatedIndex,
    },
    ref
  ) {
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheet>(null)
  const listRef = useRef<any>(null)

  const snapPoints = useMemo(() => ['25%', '55%', '92%'], [])

  useImperativeHandle(
    ref,
    () => ({
      collapse: () => sheetRef.current?.snapToIndex(0),
      expand: () => sheetRef.current?.snapToIndex(1),
      scrollToSpot: (key: string) => {
        const idx = items.findIndex((s) => s.key === key)
        if (idx < 0) return
        try {
          listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 })
        } catch {
          /* onScrollToIndexFailed が拾う */
        }
      },
    }),
    [items]
  )

  useEffect(() => {
    const winH = Dimensions.get('window').height
    onSheetPositionChange?.(winH * 0.55)
  }, [onSheetPositionChange])

  const handleSheetChange = useCallback(
    (index: number) => {
      const pct = index === 0 ? 0.25 : index === 1 ? 0.55 : 0.92
      const winH = Dimensions.get('window').height
      onSheetPositionChange?.(winH * pct)
      onSheetIndexChange?.(index)
    },
    [onSheetPositionChange, onSheetIndexChange]
  )

  // シートは画面最下部まで（bottomInset=0）描画してタブバー上の空白をなくす。
  // 代わりにリスト内側へタブバー分の余白を入れ、最後の項目が隠れないようにする。
  const listBottomPad = TAB_BAR_HEIGHT + insets.bottom + 16

  const renderItem = useCallback(
    ({ item }: { item: SheetSpot }) => (
      <NearbySheetSpotCard
        spot={item}
        userLocation={userLocation}
        onPress={() => onPressSpot(item)}
        liked={likedPlaceIds.has(item.placeId)}
        onToggleLike={() => onToggleLike(item)}
      />
    ),
    [onPressSpot, userLocation, likedPlaceIds, onToggleLike]
  )

  const listHeader = (
    <View style={styles.sheetHead}>
      {loading ? <Text style={styles.loadingTxt}>読み込み中...</Text> : null}
    </View>
  )

  const listEmpty = !loading ? (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{emptyTitle}</Text>
      <Text style={styles.emptyHint}>{emptyHint}</Text>
      {tab !== 'score' ? (
        <TouchableOpacity style={styles.discoverBtn} onPress={onDiscover}>
          <Text style={styles.discoverBtnTxt}>スポットを探す</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={NEARBY_DEFAULT_SHEET_INDEX}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        animatedIndex={animatedIndex}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
        onChange={handleSheetChange}
      >
        <BottomSheetFlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={<View style={{ height: listBottomPad }} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              try {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0,
                })
              } catch {
                /* noop */
              }
            }, 250)
          }}
        />
      </BottomSheet>
    </>
  )
  }
)

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: '#f7f6f3',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  handle: { backgroundColor: '#ccc', width: 40 },
  sheetHead: { paddingHorizontal: 16, paddingBottom: 4 },
  loadingTxt: { fontSize: 12, color: '#aaa' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#2b2a28' },
  emptyHint: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },
  discoverBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#2b2a28',
  },
  discoverBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
