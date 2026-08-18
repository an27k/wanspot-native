import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import type { PlaceResult } from '@/types/places'
import type { OpeningPeriod } from '@/lib/business-hours'

/** ボトムシート3タブ共通の軽量行 */
export type SheetSpot = {
  key: string
  placeId: string
  spotUuid: string | null
  name: string
  category: string
  address: string
  lat: number
  lng: number
  photoRef: string | null
  rating: number | null
  priceLevel: number | null
  priceLabel: string | null
  userRatingsTotal: number | null
  /** 店内ペット同伴可否。コントラクト名のまま持ち、pet-policy の述語を3面で共用する */
  pet_indoor_allowed?: boolean | null
  /** テラス席・屋外席のみ同伴可か（店内OKフィルタと直交する「テラスOK」の真実源） */
  pet_terrace_only?: boolean | null
  /** ペット同伴ステータス（outdoor_only 等。テラスOK述語のフォールバック） */
  pet_friendly_status?: string | null
  /** ペット同伴情報が確認済みか */
  pet_friendly_verified?: boolean | null
  pet_policy_evidence?: 'official' | 'aggregator' | 'reviews' | 'inferred' | null
  /** 営業時間。カードで「営業時間外」を出すのに使う */
  opening_hours?: { periods?: OpeningPeriod[] | null } | null
  /** サーバー検証済みの拡張カテゴリ（dog_run / onsen）。ジャンル推定で名称より優先する */
  extended_category?: string | null
}

export function sheetSpotFromPlace(p: PlaceResult): SheetSpot {
  return {
    key: p.place_id,
    placeId: p.place_id,
    spotUuid: null,
    name: p.name,
    category: p.category,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    photoRef: p.photo_ref,
    rating: p.rating,
    priceLevel: p.price_level,
    priceLabel: p.price_label ?? null,
    userRatingsTotal: p.user_ratings_total ?? null,
    pet_indoor_allowed: p.pet_indoor_allowed ?? null,
    pet_terrace_only: p.pet_terrace_only ?? null,
    pet_friendly_status: p.pet_friendly_status ?? null,
    pet_friendly_verified: p.pet_friendly_verified ?? null,
    pet_policy_evidence: p.pet_policy_evidence ?? null,
    opening_hours: p.opening_hours ?? null,
    extended_category: p.extended_category ?? null,
  }
}

export function sheetSpotFromUserRow(row: UserSpotRow): SheetSpot | null {
  if (row.lat == null || row.lng == null) return null
  return {
    key: row.place_id || row.id,
    placeId: row.place_id,
    spotUuid: row.id,
    name: row.name,
    category: row.category,
    address: row.address ?? '',
    lat: row.lat,
    lng: row.lng,
    photoRef: row.photoRef,
    rating: row.rating,
    priceLevel: row.priceLevel,
    priceLabel: row.priceLabel,
    userRatingsTotal: null,
    pet_indoor_allowed: row.pet_indoor_allowed ?? null,
    pet_terrace_only: row.pet_terrace_only ?? null,
    pet_friendly_status: row.pet_friendly_status ?? null,
    pet_friendly_verified: row.pet_friendly_verified ?? null,
  }
}
