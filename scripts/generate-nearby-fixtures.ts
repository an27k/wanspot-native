import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyMapConditions,
  placeMatchesGenreFilter,
  type MapConditionFilter,
} from '../lib/nearby/map-filter'
import { calcDistanceMeters } from '../lib/nearby/geo'
import {
  placeOverallScore,
  sortPlacesByScore,
  type WalkSituation,
} from '../lib/nearby/place-score'
import { sheetSpotFromPlace, type SheetSpot } from '../lib/nearby/sheet-spot'
import {
  dedupeSameSpots,
  spreadOverlappingSpots,
} from '../lib/nearby/spread-overlapping'
import { walkAlertFromTemp } from '../lib/weather/walk-alert'
import type { PlaceResult } from '../types/places'

const fixedNow = '2026-08-18T10:00:00+09:00'

const atFixedNow = <T>(iso: string, operation: () => T): T => {
  const RealDate = globalThis.Date
  const timestamp = new RealDate(iso).getTime()
  const FixedDate = class extends RealDate {
    constructor() {
      super(timestamp)
    }

    static override now(): number {
      return timestamp
    }
  }

  globalThis.Date = FixedDate as DateConstructor
  try {
    return operation()
  } finally {
    globalThis.Date = RealDate
  }
}

type PlaceOverrides = Partial<PlaceResult> & {
  place_id: string
  name?: string
}

const place = (overrides: PlaceOverrides): PlaceResult => ({
  place_id: overrides.place_id,
  name: overrides.name ?? overrides.place_id,
  category: overrides.category ?? 'カフェ',
  lat: overrides.lat ?? 35.6812,
  lng: overrides.lng ?? 139.7671,
  address: overrides.address ?? '東京都千代田区',
  photo_ref: overrides.photo_ref ?? null,
  rating: overrides.rating ?? 4,
  user_ratings_total: overrides.user_ratings_total ?? null,
  price_level: overrides.price_level ?? null,
  price_label: overrides.price_label ?? null,
  types: overrides.types,
  vicinity: overrides.vicinity,
  pet_indoor_allowed: overrides.pet_indoor_allowed,
  pet_terrace_only: overrides.pet_terrace_only,
  pet_friendly_status: overrides.pet_friendly_status,
  pet_friendly_verified: overrides.pet_friendly_verified,
  pet_policy_evidence: overrides.pet_policy_evidence,
  extended_category: overrides.extended_category,
  opening_hours: overrides.opening_hours,
  dog_interaction: overrides.dog_interaction,
  pet_size_limit: overrides.pet_size_limit,
})

const rankingInputs: {
  id: string
  spots: PlaceResult[]
  origin: { lat: number; lng: number } | null
  situation: WalkSituation | null
  now: string
}[] = [
  {
    id: 'certainty-outranks-small-distance-advantage',
    spots: [
      place({
        place_id: 'near-unknown',
        lat: 35.6813,
        pet_friendly_verified: false,
        rating: 4.8,
      }),
      place({
        place_id: 'far-confirmed',
        lat: 35.688,
        pet_friendly_verified: true,
        pet_indoor_allowed: true,
        rating: 4.2,
      }),
    ],
    origin: { lat: 35.6812, lng: 139.7671 },
    situation: null,
    now: fixedNow,
  },
  {
    id: 'known-not-allowed-and-meet-dogs-are-excluded',
    spots: [
      place({
        place_id: 'not-allowed',
        pet_friendly_verified: true,
        pet_friendly_status: 'not_allowed',
        rating: 5,
      }),
      place({
        place_id: 'meet-dogs',
        pet_friendly_verified: true,
        dog_interaction: 'meet_dogs',
        rating: 5,
      }),
      place({
        place_id: 'bring-own',
        pet_friendly_verified: true,
        pet_friendly_status: 'allowed',
        dog_interaction: 'bring_own',
        rating: 3.8,
      }),
    ],
    origin: { lat: 35.6812, lng: 139.7671 },
    situation: null,
    now: fixedNow,
  },
  {
    id: 'rain-penalizes-outdoor-only',
    spots: [
      place({
        place_id: 'outdoor',
        pet_friendly_verified: true,
        pet_terrace_only: true,
        pet_friendly_status: 'outdoor_only',
        rating: 4.9,
      }),
      place({
        place_id: 'indoor',
        pet_friendly_verified: true,
        pet_indoor_allowed: true,
        rating: 4,
      }),
    ],
    origin: { lat: 35.6812, lng: 139.7671 },
    situation: { rainy: true },
    now: fixedNow,
  },
  {
    id: 'extreme-heat-prefers-indoor-dog-run',
    spots: [
      place({
        place_id: 'outdoor-run',
        category: 'ドッグラン',
        extended_category: 'dog_run',
        pet_friendly_verified: true,
        rating: 4.8,
      }),
      place({
        place_id: 'indoor-run',
        category: 'ドッグラン',
        extended_category: 'dog_run_indoor',
        pet_friendly_verified: true,
        rating: 4,
      }),
    ],
    origin: { lat: 35.6812, lng: 139.7671 },
    situation: { heatKey: 'stop' },
    now: fixedNow,
  },
  {
    id: 'closed-business-is-penalized',
    spots: [
      place({
        place_id: 'closed',
        pet_friendly_verified: true,
        pet_indoor_allowed: true,
        rating: 4.9,
        opening_hours: {
          periods: [
            {
              open: { day: 2, time: '1800' },
              close: { day: 2, time: '1900' },
            },
          ],
        },
      }),
      place({
        place_id: 'open',
        pet_friendly_verified: true,
        pet_indoor_allowed: true,
        rating: 4,
        opening_hours: {
          periods: [
            {
              open: { day: 2, time: '0900' },
              close: { day: 2, time: '1700' },
            },
          ],
        },
      }),
    ],
    origin: { lat: 35.6812, lng: 139.7671 },
    situation: {},
    now: fixedNow,
  },
  {
    id: 'large-dog-size-limit-is-penalized',
    spots: [
      place({
        place_id: 'limited',
        pet_friendly_verified: true,
        pet_indoor_allowed: true,
        rating: 4.9,
        pet_size_limit: '大型犬不可',
      }),
      place({
        place_id: 'unlimited',
        pet_friendly_verified: true,
        pet_indoor_allowed: true,
        rating: 4,
      }),
    ],
    origin: { lat: 35.6812, lng: 139.7671 },
    situation: { dogSize: 'L' },
    now: fixedNow,
  },
]

const conditionInputs: {
  id: string
  spots: PlaceResult[]
  conditions: MapConditionFilter
  likedPlaceIds: string[]
  genre: string | null
}[] = [
  {
    id: 'indoor-only-is-strict-about-unknown',
    spots: [
      place({ place_id: 'indoor', pet_indoor_allowed: true }),
      place({ place_id: 'unknown', pet_indoor_allowed: null }),
      place({ place_id: 'outside', pet_indoor_allowed: false }),
    ],
    conditions: { indoorOnly: true, terraceOnly: false, likedOnly: false },
    likedPlaceIds: [],
    genre: 'cafe',
  },
  {
    id: 'terrace-status-fallback-and-not-allowed-defense',
    spots: [
      place({ place_id: 'flag', pet_terrace_only: true }),
      place({ place_id: 'status', pet_friendly_status: 'outdoor_only' }),
      place({
        place_id: 'contradiction',
        pet_terrace_only: true,
        pet_friendly_status: 'not_allowed',
      }),
    ],
    conditions: { indoorOnly: false, terraceOnly: true, likedOnly: false },
    likedPlaceIds: [],
    genre: 'restaurant',
  },
  {
    id: 'condition-filters-compose-with-and',
    spots: [
      place({
        place_id: 'all',
        pet_indoor_allowed: true,
        pet_terrace_only: true,
      }),
      place({
        place_id: 'not-liked',
        pet_indoor_allowed: true,
        pet_terrace_only: true,
      }),
      place({
        place_id: 'no-terrace',
        pet_indoor_allowed: true,
      }),
    ],
    conditions: { indoorOnly: true, terraceOnly: true, likedOnly: true },
    likedPlaceIds: ['all', 'no-terrace'],
    genre: 'cafe',
  },
  {
    id: 'veterinary-ignores-pet-companion-conditions',
    spots: [
      place({
        place_id: 'vet',
        category: '動物病院',
        pet_indoor_allowed: null,
        pet_terrace_only: null,
      }),
    ],
    conditions: { indoorOnly: true, terraceOnly: true, likedOnly: false },
    likedPlaceIds: [],
    genre: 'veterinary_care',
  },
]

const genreInputs: {
  id: string
  genre:
    | 'cafe'
    | 'park'
    | 'restaurant'
    | 'dog_run'
    | 'veterinary_care'
    | 'pet_hotel'
  spots: PlaceResult[]
}[] = [
  {
    id: 'cafe-rejects-restaurant-only-types',
    genre: 'cafe',
    spots: [
      place({ place_id: 'cafe', category: 'スポット', types: ['cafe'] }),
      place({
        place_id: 'restaurant',
        category: 'レストラン',
        types: ['restaurant'],
      }),
    ],
  },
  {
    id: 'dog-run-accepts-extended-category-and-name-variation',
    genre: 'dog_run',
    spots: [
      place({
        place_id: 'extended',
        category: '公園',
        extended_category: 'dog_run_indoor',
      }),
      place({
        place_id: 'name',
        name: 'ドックラン エム 恵比寿',
        category: 'スポット',
      }),
      place({ place_id: 'noise', name: '犬用品店', category: 'ペットショップ' }),
    ],
  },
  {
    id: 'pet-hotel-drops-grooming-only-name',
    genre: 'pet_hotel',
    spots: [
      place({ place_id: 'grooming', name: 'トリミングサロン ポチ' }),
      place({ place_id: 'hotel', name: 'トリミング＆ペットホテル ポチ' }),
    ],
  },
]

const coordinateInputs: {
  id: string
  spots: PlaceResult[]
}[] = [
  {
    id: 'deduplicates-same-name-and-spreads-distinct-spots',
    spots: [
      place({
        place_id: 'b',
        name: 'ワン カフェ',
        lat: 35.681234,
        lng: 139.767123,
      }),
      place({
        place_id: 'duplicate',
        name: 'ワン　カフェ',
        lat: 35.681231,
        lng: 139.767121,
      }),
      place({
        place_id: 'a',
        name: '併設動物病院',
        lat: 35.681234,
        lng: 139.767123,
      }),
      place({
        place_id: 'solo',
        name: '少し離れた公園',
        lat: 35.682,
        lng: 139.768,
      }),
    ],
  },
  {
    id: 'three-overlaps-use-stable-key-order',
    spots: [
      place({ place_id: 'z', lat: 34.7, lng: 135.5 }),
      place({ place_id: 'x', lat: 34.7, lng: 135.5 }),
      place({ place_id: 'y', lat: 34.7, lng: 135.5 }),
    ],
  },
]

const distanceInputs = [
  {
    id: 'same-point',
    origin: { lat: 35.6812, lng: 139.7671 },
    point: { lat: 35.6812, lng: 139.7671 },
  },
  {
    id: 'tokyo-station-to-imperial-palace',
    origin: { lat: 35.681236, lng: 139.767125 },
    point: { lat: 35.685175, lng: 139.752799 },
  },
  {
    id: 'crosses-antimeridian',
    origin: { lat: 35, lng: 179.9 },
    point: { lat: 35, lng: -179.9 },
  },
]

const weatherInputs = [
  {
    id: 'standard-comfortable',
    tempC: 24,
    humidityPct: null,
    feelsLikeC: null,
    heatSensitivity: 0,
    ageMonths: null,
  },
  {
    id: 'short-nosed-dog-stops-four-degrees-earlier',
    tempC: 31,
    humidityPct: null,
    feelsLikeC: null,
    heatSensitivity: 2,
    ageMonths: null,
  },
  {
    id: 'humid-caution-escalates-to-danger',
    tempC: 28,
    humidityPct: 70,
    feelsLikeC: null,
    heatSensitivity: 0,
    ageMonths: null,
  },
  {
    id: 'senior-age-combines-with-breed-and-caps-at-two',
    tempC: 31,
    humidityPct: null,
    feelsLikeC: null,
    heatSensitivity: 1,
    ageMonths: 130,
  },
]

const sheetSpots = (spots: PlaceResult[]): SheetSpot[] => spots.map(sheetSpotFromPlace)

const fixture = {
  schemaVersion: 1,
  source: [
    'lib/nearby/geo.ts',
    'lib/nearby/map-filter.ts',
    'lib/nearby/pet-policy.ts',
    'lib/nearby/place-score.ts',
    'lib/nearby/spread-overlapping.ts',
    'lib/weather/walk-alert.ts',
  ],
  ranking: rankingInputs.map((input) => {
    const expected = atFixedNow(input.now, () => {
      const ordered = sortPlacesByScore(input.spots, input.origin, input.situation)
      return {
        placeIds: ordered.map((spot) => spot.place_id),
        scores: Object.fromEntries(
          ordered.map((spot) => [
            spot.place_id,
            placeOverallScore(spot, input.origin, input.situation),
          ])
        ),
      }
    })
    return {
      ...input,
      situation: input.situation
        ? {
            rainy: input.situation.rainy ?? false,
            dogSize: input.situation.dogSize ?? null,
            heatLevel: input.situation.heatKey ?? null,
            travel: input.situation.travel ?? 'walking',
          }
        : null,
      expected,
    }
  }),
  conditions: conditionInputs.map((input) => {
    const liked = new Set(input.likedPlaceIds)
    const expected = applyMapConditions(
      sheetSpots(input.spots),
      input.conditions,
      (spot) => liked.has(spot.placeId),
      input.genre
    ).map((spot) => spot.placeId)
    return { ...input, expected }
  }),
  genres: genreInputs.map((input) => ({
    ...input,
    expected: input.spots
      .filter((spot) => placeMatchesGenreFilter(spot, input.genre))
      .map((spot) => spot.place_id),
  })),
  coordinates: coordinateInputs.map((input) => {
    const deduplicated = dedupeSameSpots(sheetSpots(input.spots))
    const spread = spreadOverlappingSpots(deduplicated)
    return {
      ...input,
      expectedDeduplicatedPlaceIds: deduplicated.map((spot) => spot.placeId),
      expectedSpread: spread.map((spot) => ({
        placeId: spot.placeId,
        displayLat: spot.displayLat,
        displayLng: spot.displayLng,
      })),
    }
  }),
  distances: distanceInputs.map((input) => ({
    ...input,
    expectedMeters: calcDistanceMeters(
      input.origin.lat,
      input.origin.lng,
      input.point.lat,
      input.point.lng
    ),
  })),
  weather: {
    alerts: weatherInputs.map((input) => ({
      ...input,
      expected: walkAlertFromTemp(input.tempC, {
        humidityPct: input.humidityPct,
        feelsLikeC: input.feelsLikeC,
        heatSensitivity: input.heatSensitivity,
        ageMonths: input.ageMonths,
      }).key,
    })),
  },
}

const currentFile = fileURLToPath(import.meta.url)
const output = resolve(
  dirname(currentFile),
  '../swift/WanspotKit/Tests/WanspotKitTests/Fixtures/nearby-domain.json'
)

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`Wrote ${output}`)
