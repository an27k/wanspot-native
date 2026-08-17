import { wanspotPublicUrl } from '@/lib/wanspot-api'

/**
 * 共有するイベントのURL。
 *
 * リンク先はWebのイベント詳細にする。アプリ未導入の相手でもそのまま開けて、
 * ページ内にアプリへの導線がある。アプリのディープリンクを渡すと、
 * 入れていない相手には何も表示されない。
 *
 * どの共有ボタンが効いたかを見るため、発生元をクエリに載せる。
 * Web側の read/DL の計測と同じ語彙（ref / ref_from）を使う。
 */
export function eventShareUrl(slug: string): string {
  return wanspotPublicUrl(
    `/events/${encodeURIComponent(slug)}?ref=share&ref_from=app_event_detail`
  )
}
