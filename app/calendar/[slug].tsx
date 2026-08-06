import { useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AiSummaryCard } from '@/components/common/AiSummaryCard'
import { PowState } from '@/components/DogStates'
import { PriceLevelMark } from '@/components/calendar/PriceLevelMark'
import { colors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { takeCalendarEvent } from '@/lib/calendar/calendar-detail-stash'
import {
  fetchNearbySpots,
  formatNearbyDistance,
  NEARBY_KIND_LABEL,
  toPlaceResult,
  type NearbySpot,
} from '@/lib/calendar/nearby-spots'
import { openSpotDetailFromPlace } from '@/lib/open-spot-detail'
import { eventShareUrl } from '@/lib/calendar/event-share'
import { directLinksOnly, occurrenceLabel } from '@/lib/calendar/types'
import { remoteImageAcceptHeaders, remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

/** WordPress 等の HTML エンティティを表示用に戻す（&#038; → & など） */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** 途中切れマーカーを除去（表示時の全文化） */
function stripTrailingEllipsis(input: string): string {
  return input.replace(/\s*\[\.\.\.\]\s*$/u, '').replace(/\s*…\s*$/u, '').trim()
}

function openExternal(url: string): void {
  if (!/^https?:\/\//.test(url)) return
  void Linking.openURL(url)
}

export default function CalendarEventDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const event = useMemo(() => (typeof slug === 'string' ? takeCalendarEvent(slug) : null), [slug])

  const padTop = insets.top + 8

  // 周辺スポットは詳細を開いたときだけ取りに行く。
  // 一覧APIに含めると1か月ぶん（100件超 × 最大6スポット）を毎回運ぶことになる
  const [nearby, setNearby] = useState<NearbySpot[]>([])
  useEffect(() => {
    if (!event?.id) return
    let alive = true
    void fetchNearbySpots(event.id).then((spots) => {
      if (alive) setNearby(spots)
    })
    return () => {
      alive = false
    }
  }, [event?.id])

  if (!event) {
    // メモリスタッシュ経由でのみ開く画面のため、直リンクやプロセス再起動後は カレンダーへ誘導する
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: padTop }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12} accessibilityLabel="戻る">
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>イベント</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.missWrap}>
          <PowState label="イベント情報を表示できませんでした。カレンダーから開き直してください。" />
        </View>
      </View>
    )
  }

  // 収集元のまとめサイトは出さない。押しても掲載元の記事に戻るだけで、
  // 読者はそこから改めて公式を探すことになる
  const relatedUrls = directLinksOnly(
    [event.official_url, ...(event.related_urls ?? [])],
    event.source_url
  )
  const mapsUrl =
    event.lat != null && event.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`
      : null

  /**
   * イベントを人に渡す。
   *
   * 犬連れは同伴条件を気にするので、条件を調べ終わった状態のページごと渡せると
   * そのまま予定が決まる。受け取った側が開かなくても行けるか判断できるよう、
   * 日付と会場を文面に入れる。リンク先はWebのイベント詳細で、
   * アプリ未導入の相手にもそのまま開ける。
   */
  // event の絞り込みは関数の中まで残らないので、確定した値を引数で渡す
  async function shareEvent(target: typeof event & object): Promise<void> {
    const first = target.occurrences?.[0]
    const detail = [first ? occurrenceLabel(first) : null, target.venue_name]
      .filter(Boolean)
      .join(' / ')
    const message = detail ? `${target.title}（${detail}）` : target.title
    try {
      await Share.share({ message: `${message}\n${eventShareUrl(target.slug)}` })
    } catch {
      // 共有シートを閉じただけ。何もしない
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: padTop }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12} accessibilityLabel="戻る">
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          イベント
        </Text>
        <Pressable
          style={styles.shareBtn}
          onPress={() => void shareEvent(event)}
          hitSlop={12}
          accessibilityLabel="共有"
        >
          <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {event.thumbnail_url ? (
          <Image
            // 原本は約2MBのPNG。ヒーロー表示でも card 幅(800px)で十分
            source={{
              uri: resizePlacesImageUrl(event.thumbnail_url, 'card'),
              headers: remoteImageAcceptHeaders,
            }}
            style={styles.hero}
            contentFit="cover"
            {...remoteImageExpoProps}
          />
        ) : null}

        <View style={styles.body}>
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.tagRow}>
            <PriceLevelMark level={event.price_level} size="md" />
            {(event.tags ?? []).map((t) => (
              <View key={t.id} style={[styles.tagPill, { borderColor: t.color }]}>
                <Text style={styles.tagPillTxt}>{t.name}</Text>
              </View>
            ))}
          </View>

          {/* 開催日時（JST固定表示） */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>開催日時</Text>
            {(event.occurrences ?? []).map((oc) => (
              <Text key={oc.id} style={styles.sectionLine}>
                {occurrenceLabel(oc)}
              </Text>
            ))}
            {event.last_entry_text ? (
              <Text style={styles.sectionSub}>最終入場 {event.last_entry_text}</Text>
            ) : null}
          </View>

          {/* 会場 */}
          {event.venue_name || event.address ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>会場</Text>
              {event.venue_name ? (
                <Text style={styles.sectionLine}>{decodeHtmlEntities(event.venue_name)}</Text>
              ) : null}
              {event.address ? (
                <Text style={styles.sectionSub}>{decodeHtmlEntities(event.address)}</Text>
              ) : null}
              {mapsUrl ? (
                <Pressable style={styles.mapBtn} onPress={() => openExternal(mapsUrl)} accessibilityLabel="地図で見る">
                  <Ionicons name="map-outline" size={16} color={colors.brandDark} />
                  <Text style={styles.mapBtnTxt}>地図で見る</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* ワンスポAIレビュー（全文表示。description と重複するためイベント内容セクションは出さない） */}
          {(event.ai_summary?.trim() || event.description?.trim()) ? (
            <AiSummaryCard
              heading="ワンスポ AIレビュー"
              body={stripTrailingEllipsis((event.ai_summary?.trim() || event.description?.trim())!)}
              collapsedLines={0}
            />
          ) : null}

          {event.price_text ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>料金</Text>
              <Text style={styles.sectionLine}>{event.price_text}</Text>
            </View>
          ) : null}

          {/* あわせて行ける周辺スポット。イベント単体で行き止まりにしない。
              サーバ側で「イベント帰りにその日そのまま寄れるか」で選んでいる
              （予約制・保護犬施設・閉店済みを外し、冬はテラス席のみも外す）。
              「遊ぶ」枠は廃止した。会場でもう走らせた帰りに行く先ではない */}
          {nearby.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {nearby.some((s) => s.kind === 'stay') ? '泊まりで行くなら' : '前後に寄るなら'}
              </Text>
              {nearby.map((spot) => (
                <Pressable
                  key={spot.spot_id}
                  style={styles.nearbyRow}
                  // ルートは /spots/[id] で、place_id を鍵に開く。
                  // `/spot/${id}` に push していたため Unmatched Route になっていた
                  onPress={() => openSpotDetailFromPlace(router, toPlaceResult(spot), spot.spot_id)}
                >
                  <View style={styles.nearbyBody}>
                    <Text style={styles.nearbyName} numberOfLines={1}>
                      {spot.name}
                    </Text>
                    <Text style={styles.nearbyMeta}>
                      {[
                        NEARBY_KIND_LABEL[spot.kind],
                        formatNearbyDistance(spot.distance_m),
                        // 評価は選んだ理由そのもの。出さないと近い順に見える
                        spot.rating != null ? `★${spot.rating}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* 関連URL（①=公式） */}
          {relatedUrls.length > 0 || event.ticket_url ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>リンク</Text>
              {relatedUrls.slice(0, CIRCLED.length).map((url, i) => (
                <Pressable key={url} style={styles.linkRow} onPress={() => openExternal(url)}>
                  <Text style={styles.linkNum}>{CIRCLED[i]}</Text>
                  <Text style={styles.linkTxt} numberOfLines={1}>
                    {i === 0 ? '公式サイト' : url.replace(/^https?:\/\//, '')}
                  </Text>
                  <Ionicons name="open-outline" size={15} color={colors.textSecondary} />
                </Pressable>
              ))}
              {event.ticket_url && /^https?:\/\//.test(event.ticket_url) ? (
                <Pressable style={styles.linkRow} onPress={() => openExternal(event.ticket_url!)}>
                  <Ionicons name="ticket-outline" size={16} color={colors.brandDark} />
                  <Text style={[styles.linkTxt, { color: colors.brandDark, fontWeight: '700' }]}>チケット</Text>
                  <Ionicons name="open-outline" size={15} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, ...type.button, color: colors.textPrimary, textAlign: 'center' as const },
  headerSpacer: { width: 44 },
  shareBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  missWrap: { marginTop: 48, alignItems: 'center', paddingHorizontal: 24 },
  hero: { width: '100%', height: 210, backgroundColor: colors.border },
  body: { padding: 16, gap: 12 },
  title: { ...type.title, color: colors.textPrimary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  tagPillTxt: { ...type.label, color: colors.textSecondary },
  sectionCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  // カード内の見出しは heading(20) ではなく label。中身より小さい灰色の
  // マイクロラベルとして置く設計で、大きくすると本文と主従が入れ替わる
  sectionTitle: { ...type.label, color: colors.textSecondary, marginBottom: 2 },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nearbyBody: { flex: 1, minWidth: 0 },
  // 押せる行なので、同じ 17 でも静的な sectionLine と太さで区別する
  nearbyName: { ...type.row, fontWeight: '700' as const, color: colors.textPrimary },
  nearbyMeta: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
  sectionLine: { ...type.row, color: colors.textPrimary },
  sectionSub: { ...type.caption, color: colors.textSecondary },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.tintWeak,
  },
  mapBtnTxt: { ...type.button, color: colors.brandDark },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  linkNum: { ...type.row, color: colors.textSecondary },
  linkTxt: { flex: 1, ...type.row, color: colors.textPrimary },
})
