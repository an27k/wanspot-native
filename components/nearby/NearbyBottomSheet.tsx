import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react'
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import BottomSheet, { BottomSheetFlatList, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { NearbySheetSpotCard } from '@/components/nearby/NearbySheetSpotCard'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import { colors } from '@/constants/colors'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'

/** ハンドル＋ジャンル行＋× が視認できる折りたたみ高さ（タブバー上） */
const PEEK_HEADER_H = 82

/** お散歩アラート等と同じクリアなグレーガラスの下地 */
function SheetBackground({ style }: BottomSheetBackgroundProps) {
  return (
    <View style={[style, styles.sheetBg]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={GOOGLE_HOME.blurIntensity}
          tint={GOOGLE_HOME.blurTint}
          style={styles.sheetBgFill}
        />
      ) : null}
      <View style={styles.sheetBgTint} />
    </View>
  )
}

export type NearbySheetTab = 'score' | 'like' | 'visited'

export type NearbySheetHandle = {
  open: () => void
  close: () => void
  scrollToSpot: (key: string) => void
  /** @deprecated use open/close */
  collapse: () => void
  /** @deprecated use open */
  expand: () => void
}

type NearbyBottomSheetProps = {
  open: boolean
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
  onClose: () => void
  headerIcon: ReactNode
  headerTitle: string
  headerCount: number
  onSheetPositionChange?: (bottomInset: number) => void
  onSheetIndexChange?: (index: number) => void
  animatedIndex?: SharedValue<number>
}

export const NearbyBottomSheet = forwardRef<NearbySheetHandle, NearbyBottomSheetProps>(
  function NearbyBottomSheet(
    {
      open,
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
      onClose,
      headerIcon,
      headerTitle,
      headerCount,
      onSheetPositionChange,
      onSheetIndexChange,
      animatedIndex,
    },
    ref
  ) {
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheet>(null)
  const listRef = useRef<any>(null)

  const peekSnap = TAB_BAR_HEIGHT + insets.bottom + PEEK_HEADER_H

  const snapPoints = useMemo(
    () => [peekSnap, '48%', '88%'],
    [peekSnap]
  )

  useEffect(() => {
    if (!open) {
      sheetRef.current?.close()
      return
    }
    const id = requestAnimationFrame(() => sheetRef.current?.snapToIndex(1))
    return () => cancelAnimationFrame(id)
  }, [open])

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.snapToIndex(1),
      close: () => sheetRef.current?.close(),
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

  const handleSheetChange = useCallback(
    (index: number) => {
      onSheetIndexChange?.(index)
      if (index < 0) {
        onSheetPositionChange?.(0)
        return
      }
      const winH = Dimensions.get('window').height
      if (index === 0) onSheetPositionChange?.(peekSnap)
      else if (index === 1) onSheetPositionChange?.(winH * 0.48)
      else onSheetPositionChange?.(winH * 0.88)
    },
    [onSheetIndexChange, onSheetPositionChange, peekSnap]
  )

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
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>{headerIcon}</View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerCount}>
            {loading ? '読み込み中…' : `${headerCount}件`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="リストを閉じる"
        >
          <Ionicons name="close" size={22} color={GOOGLE_HOME.textPrimary} />
        </TouchableOpacity>
      </View>
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
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      animatedIndex={animatedIndex}
      style={styles.sheetFill}
      backgroundComponent={SheetBackground}
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
  )
  }
)

const styles = StyleSheet.create({
  sheetFill: {
    flex: 1,
  },
  sheetBg: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.panelBorder,
  },
  sheetBgFill: { ...StyleSheet.absoluteFillObject },
  sheetBgTint: { ...StyleSheet.absoluteFillObject, backgroundColor: GOOGLE_HOME.panelBg },
  handle: { backgroundColor: 'rgba(255,255,255,0.45)', width: 40 },
  sheetHead: { paddingHorizontal: 16, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GOOGLE_HOME.listGenreBg,
    borderWidth: 1,
    borderColor: GOOGLE_HOME.listGenreBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: GOOGLE_HOME.textPrimary },
  headerCount: { fontSize: 13, fontWeight: '600', color: GOOGLE_HOME.textSecondary },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: GOOGLE_HOME.textPrimary },
  emptyHint: { fontSize: 13, color: GOOGLE_HOME.textSecondary, textAlign: 'center', lineHeight: 20 },
  discoverBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  discoverBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
