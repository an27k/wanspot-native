/**
 * API が空・不正なときの表示用（サーバー側フォールバックと揃える）。
 * キャッシュ更新後は API 側の一覧に置き換わる。
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

const link = (label: string, url: string) => ({ label, url })

export const EXTERNAL_EVENTS_EMPTY_FALLBACK: ExternalEventFallbackRow[] = [
  {
    id: 'wanspot-ext-sample-1',
    title: 'ドッグイベント・ペット関連（Peatix で検索）',
    description: '※API の自動一覧がまだないときの案内です。下のリンクから最新情報を確認できます。',
    event_at: '2026-06-01T10:00:00+09:00',
    location_name: '各地・オンライン',
    area: '全国',
    url: 'https://peatix.com/',
    source: 'Peatix',
    links: [link('Peatix', 'https://peatix.com/'), link('doorkeeper', 'https://www.doorkeeper.jp/')],
  },
  {
    id: 'wanspot-ext-sample-2',
    title: '犬・ペットのイベント情報（dogfan.jp）',
    description: 'ドッグファン掲載のイベント・おでかけ情報の一例への導線です。',
    event_at: '2026-07-15T11:00:00+09:00',
    location_name: '掲載会場に準ずる',
    area: '全国',
    url: 'https://dogfan.jp/',
    source: 'dogfan.jp',
    links: [link('dogfan.jp', 'https://dogfan.jp/'), link('inupamo.jp', 'https://inupamo.jp/')],
  },
  {
    id: 'wanspot-ext-sample-3',
    title: 'ペットサポート・イベント案内',
    description: 'ペット関連メディア・サポートサイトからの情報収集用リンクです。',
    event_at: '2026-08-20T09:00:00+09:00',
    location_name: '掲載会場に準ずる',
    area: '全国',
    url: 'https://www.pets-support.com/',
    source: 'pets-support.com',
    links: [link('pets-support.com', 'https://www.pets-support.com/'), link('konstage.jp', 'https://konstage.jp/')],
  },
  {
    id: 'wanspot-external-events-fallback',
    title: 'ほかの掲載サイトをまとめて開く',
    description:
      '運営の週次ジョブで一覧が入ると、この下のサンプル行は本番データに置き換わります。',
    event_at: null,
    location_name: null,
    area: '全国',
    url: 'https://peatix.com/',
    source: '案内',
    links: [
      link('Peatix', 'https://peatix.com/'),
      link('doorkeeper', 'https://www.doorkeeper.jp/'),
      link('dogfan.jp', 'https://dogfan.jp/'),
      link('pets-support.com', 'https://www.pets-support.com/'),
      link('inupamo.jp', 'https://inupamo.jp/'),
    ],
  },
]
