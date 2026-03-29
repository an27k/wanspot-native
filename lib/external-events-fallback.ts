/**
 * API が空配列を返す場合（本番未更新・空キャッシュ等）のクライアント側フォールバック。
 * wanspot の src/lib/external-events-fallback.ts と内容を揃える。
 */
export type ExternalEventFallbackRow = {
  id?: string
  title: string
  description: string | null
  event_at: string | null
  location_name: string | null
  area: string | null
  url: string | null
  source: string | null
  links?: { label: string; url: string }[] | null
}

export const EXTERNAL_EVENTS_EMPTY_FALLBACK: ExternalEventFallbackRow[] = [
  {
    id: 'wanspot-external-events-fallback',
    title: 'ペットイベントを各サイトで探す',
    description:
      '自動取得の一覧がまだありません。運営がキャッシュを更新すると、ここにイベントが表示されます。それまで下のリンクから主要サイトを開いてください。',
    event_at: null,
    location_name: null,
    area: '全国',
    url: 'https://peatix.com/',
    source: '案内',
    links: [
      { label: 'Peatix', url: 'https://peatix.com/' },
      { label: 'doorkeeper', url: 'https://www.doorkeeper.jp/' },
      { label: 'dogfan.jp', url: 'https://dogfan.jp/' },
      { label: 'pets-support.com', url: 'https://www.pets-support.com/' },
      { label: 'inupamo.jp', url: 'https://inupamo.jp/' },
    ],
  },
]
