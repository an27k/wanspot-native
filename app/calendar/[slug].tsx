import { useMemo } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AiSummaryCard } from '@/components/common/AiSummaryCard'
import { PowState } from '@/components/DogStates'
import { PriceLevelMark } from '@/components/calendar/PriceLevelMark'
import { colors } from '@/constants/colors'
import { takeCalendarEvent } from '@/lib/calendar/calendar-detail-stash'
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

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: padTop }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12} accessibilityLabel="戻る">
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          イベント
        </Text>
        <View style={styles.headerSpacer} />
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

          {/* AIまとめ（全文表示。description と重複するためイベント内容セクションは出さない） */}
          {(event.ai_summary?.trim() || event.description?.trim()) ? (
            <AiSummaryCard
              heading="🐾 ワンスポAIまとめ"
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  headerSpacer: { width: 44 },
  missWrap: { marginTop: 48, alignItems: 'center', paddingHorizontal: 24 },
  hero: { width: '100%', height: 210, backgroundColor: colors.border },
  body: { padding: 16, gap: 12 },
  title: { fontSize: 19, fontWeight: '800', color: colors.textPrimary, lineHeight: 26 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  tagPillTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  sectionCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginBottom: 2 },
  sectionLine: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 21 },
  sectionSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
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
  mapBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.brandDark },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  linkNum: { fontSize: 14, color: colors.textSecondary },
  linkTxt: { flex: 1, fontSize: 13, color: colors.textPrimary },
})
