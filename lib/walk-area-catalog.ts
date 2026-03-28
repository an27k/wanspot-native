/**
 * 主要エリアの代表座標（散歩エリアタグの候補）。
 * 現在地からの距離で「10km以内」を絞り込み、検索はラベル部分一致。
 */

import { NATIONAL_WALK_AREAS } from '@/lib/walk-area-catalog-data'

export type WalkAreaCatalogEntry = {
  id: string
  label: string
  lat: number
  lng: number
}

const R = 6371000

function distMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** 東京23区 */
const TOKYO23: WalkAreaCatalogEntry[] = [
  { id: 'tk-chiyoda', label: '千代田区', lat: 35.694, lng: 139.754 },
  { id: 'tk-chuo', label: '中央区', lat: 35.6704, lng: 139.7716 },
  { id: 'tk-minato', label: '港区', lat: 35.6581, lng: 139.7514 },
  { id: 'tk-shinjuku', label: '新宿区', lat: 35.6938, lng: 139.7034 },
  { id: 'tk-bunkyo', label: '文京区', lat: 35.7081, lng: 139.7522 },
  { id: 'tk-taito', label: '台東区', lat: 35.7126, lng: 139.78 },
  { id: 'tk-sumida', label: '墨田区', lat: 35.71, lng: 139.8015 },
  { id: 'tk-koto', label: '江東区', lat: 35.6738, lng: 139.8174 },
  { id: 'tk-shinagawa', label: '品川区', lat: 35.6094, lng: 139.7303 },
  { id: 'tk-meguro', label: '目黒区', lat: 35.6414, lng: 139.6982 },
  { id: 'tk-ota', label: '大田区', lat: 35.5613, lng: 139.7161 },
  { id: 'tk-setagaya', label: '世田谷区', lat: 35.6464, lng: 139.6533 },
  { id: 'tk-shibuya', label: '渋谷区', lat: 35.6639, lng: 139.6982 },
  { id: 'tk-nakano', label: '中野区', lat: 35.7074, lng: 139.6638 },
  { id: 'tk-suginami', label: '杉並区', lat: 35.6995, lng: 139.6364 },
  { id: 'tk-toshima', label: '豊島区', lat: 35.7296, lng: 139.7153 },
  { id: 'tk-kita', label: '北区', lat: 35.7528, lng: 139.7334 },
  { id: 'tk-arakawa', label: '荒川区', lat: 35.7361, lng: 139.7834 },
  { id: 'tk-itabashi', label: '板橋区', lat: 35.7512, lng: 139.7091 },
  { id: 'tk-nerima', label: '練馬区', lat: 35.7356, lng: 139.6517 },
  { id: 'tk-adachi', label: '足立区', lat: 35.7751, lng: 139.8047 },
  { id: 'tk-katsushika', label: '葛飾区', lat: 35.7433, lng: 139.8472 },
  { id: 'tk-edogawa', label: '江戸川区', lat: 35.7064, lng: 139.8683 },
]

/** 東京多摩・近郊（よく散歩されるエリア） */
const TOKYO_TAMA: WalkAreaCatalogEntry[] = [
  { id: 'tk-hachi', label: '八王子市', lat: 35.6559, lng: 139.3237 },
  { id: 'tk-tachikawa', label: '立川市', lat: 35.694, lng: 139.4136 },
  { id: 'tk-mitaka', label: '三鷹市', lat: 35.6834, lng: 139.5597 },
  { id: 'tk-chofu', label: '調布市', lat: 35.6506, lng: 139.5407 },
  { id: 'tk-machida', label: '町田市', lat: 35.5464, lng: 139.4386 },
  { id: 'tk-kodaira', label: '小平市', lat: 35.7286, lng: 139.4774 },
  { id: 'tk-koganei', label: '小金井市', lat: 35.6995, lng: 139.5028 },
  { id: 'tk-kokubunji', label: '国分寺市', lat: 35.7009, lng: 139.4803 },
  { id: 'tk-kunitachi', label: '国立市', lat: 35.6839, lng: 139.441 },
  { id: 'tk-fuchu', label: '府中市', lat: 35.6689, lng: 139.4776 },
  { id: 'tk-komae', label: '狛江市', lat: 35.6346, lng: 139.5786 },
  { id: 'tk-hino', label: '日野市', lat: 35.6711, lng: 139.395 },
  { id: 'tk-akishima', label: '昭島市', lat: 35.7056, lng: 139.3539 },
  { id: 'tk-hamura', label: '羽村市', lat: 35.7672, lng: 139.311 },
  { id: 'tk-akiruno', label: 'あきる野市', lat: 35.7289, lng: 139.2941 },
  { id: 'tk-musashino', label: '武蔵野市', lat: 35.702, lng: 139.5593 },
  { id: 'tk-nishitokyo', label: '西東京市', lat: 35.7256, lng: 139.5383 },
]

/** 神奈川 */
const KANAGAWA: WalkAreaCatalogEntry[] = [
  { id: 'kn-yokohama-tsurumi', label: '横浜市鶴見区', lat: 35.5081, lng: 139.6822 },
  { id: 'kn-yokohama-kanagawa', label: '横浜市神奈川区', lat: 35.4773, lng: 139.622 },
  { id: 'kn-yokohama-nishi', label: '横浜市西区', lat: 35.4535, lng: 139.6228 },
  { id: 'kn-yokohama-naka', label: '横浜市中区', lat: 35.444, lng: 139.642 },
  { id: 'kn-yokohama-minami', label: '横浜市南区', lat: 35.4294, lng: 139.609 },
  { id: 'kn-yokohama-hodogaya', label: '横浜市保土ケ谷区', lat: 35.46, lng: 139.596 },
  { id: 'kn-yokohama-isogo', label: '横浜市磯子区', lat: 35.402, lng: 139.617 },
  { id: 'kn-yokohama-kanazawa', label: '横浜市金沢区', lat: 35.339, lng: 139.622 },
  { id: 'kn-yokohama-kohoku', label: '横浜市港北区', lat: 35.519, lng: 139.633 },
  { id: 'kn-yokohama-totsuka', label: '横浜市戸塚区', lat: 35.4004, lng: 139.534 },
  { id: 'kn-yokohama-sakae', label: '横浜市栄区', lat: 35.364, lng: 139.554 },
  { id: 'kn-yokohama-izumi', label: '横浜市泉区', lat: 35.418, lng: 139.498 },
  { id: 'kn-yokohama-aoba', label: '横浜市青葉区', lat: 35.553, lng: 139.537 },
  { id: 'kn-yokohama-tsuzuki', label: '横浜市都筑区', lat: 35.535, lng: 139.575 },
  { id: 'kn-yokohama-asahi', label: '横浜市旭区', lat: 35.475, lng: 139.532 },
  { id: 'kn-yokohama-midori', label: '横浜市緑区', lat: 35.512, lng: 139.538 },
  { id: 'kn-yokohama-seya', label: '横浜市瀬谷区', lat: 35.467, lng: 139.502 },
  { id: 'kn-yokohama-konan', label: '横浜市港南区', lat: 35.401, lng: 139.596 },
  { id: 'kn-kawasaki-kawasaki', label: '川崎市川崎区', lat: 35.5308, lng: 139.703 },
  { id: 'kn-kawasaki-saiwai', label: '川崎市幸区', lat: 35.544, lng: 139.699 },
  { id: 'kn-kawasaki-nakahara', label: '川崎市中原区', lat: 35.576, lng: 139.655 },
  { id: 'kn-kawasaki-takatsu', label: '川崎市高津区', lat: 35.599, lng: 139.617 },
  { id: 'kn-kawasaki-miyamae', label: '川崎市宮前区', lat: 35.589, lng: 139.58 },
  { id: 'kn-kawasaki-asao', label: '川崎市麻生区', lat: 35.603, lng: 139.505 },
  { id: 'kn-kawasaki-tama', label: '川崎市多摩区', lat: 35.62, lng: 139.557 },
  { id: 'kn-fujisawa', label: '藤沢市', lat: 35.339, lng: 139.491 },
  { id: 'kn-kamakura', label: '鎌倉市', lat: 35.319, lng: 139.55 },
  { id: 'kn-yokosuka', label: '横須賀市', lat: 35.281, lng: 139.672 },
  { id: 'kn-sagamihara-midori', label: '相模原市緑区', lat: 35.595, lng: 139.338 },
  { id: 'kn-sagamihara-chuo', label: '相模原市中央区', lat: 35.571, lng: 139.373 },
  { id: 'kn-sagamihara-minami', label: '相模原市南区', lat: 35.531, lng: 139.437 },
  { id: 'kn-hiratsuka', label: '平塚市', lat: 35.335, lng: 139.349 },
  { id: 'kn-odawara', label: '小田原市', lat: 35.264, lng: 139.152 },
  { id: 'kn-atsugi', label: '厚木市', lat: 35.443, lng: 139.362 },
  { id: 'kn-yamato', label: '大和市', lat: 35.487, lng: 139.457 },
  { id: 'kn-chigasaki', label: '茅ヶ崎市', lat: 35.334, lng: 139.404 },
]

/** 埼玉・千葉（首都圏・政令市の区は national に含む） */
const SAITAMA_CHIBA: WalkAreaCatalogEntry[] = [
  { id: 'sa-kawagoe', label: '川越市', lat: 35.9251, lng: 139.4858 },
  { id: 'sa-kumagaya', label: '熊谷市', lat: 36.147, lng: 139.388 },
  { id: 'sa-koshigaya', label: '越谷市', lat: 35.891, lng: 139.791 },
  { id: 'sa-kasukabe', label: '春日部市', lat: 35.975, lng: 139.752 },
  { id: 'sa-kawaguchi', label: '川口市', lat: 35.807, lng: 139.724 },
  { id: 'sa-toda', label: '戸田市', lat: 35.817, lng: 139.678 },
  { id: 'sa-wako', label: '和光市', lat: 35.781, lng: 139.605 },
  { id: 'sa-asaka', label: '朝霞市', lat: 35.797, lng: 139.593 },
  { id: 'sa-niiza', label: '新座市', lat: 35.793, lng: 139.565 },
  { id: 'sa-tokorozawa', label: '所沢市', lat: 35.799, lng: 139.468 },
  { id: 'cb-funabashi', label: '船橋市', lat: 35.6947, lng: 139.982 },
  { id: 'cb-kashiwa', label: '柏市', lat: 35.868, lng: 139.976 },
  { id: 'cb-ichikawa', label: '市川市', lat: 35.722, lng: 139.931 },
  { id: 'cb-matsudo', label: '松戸市', lat: 35.787, lng: 139.903 },
  { id: 'cb-kisarazu', label: '木更津市', lat: 35.375, lng: 139.916 },
  { id: 'cb-narita', label: '成田市', lat: 35.776, lng: 140.318 },
]

/** 大阪・名古屋圏など（政令市の区単位は national 側） */
const OTHER_METROS: WalkAreaCatalogEntry[] = [
  { id: 'os-higashiosaka', label: '東大阪市', lat: 34.679, lng: 135.601 },
  { id: 'os-toyonaka', label: '豊中市', lat: 34.781, lng: 135.47 },
  { id: 'os-suita', label: '吹田市', lat: 34.759, lng: 135.516 },
  { id: 'os-takatsuki', label: '高槻市', lat: 34.846, lng: 135.617 },
  { id: 'os-ibaraki', label: '茨木市', lat: 34.816, lng: 135.569 },
  { id: 'os-hirakata', label: '枚方市', lat: 34.814, lng: 135.65 },
  { id: 'os-nishinomiya', label: '西宮市', lat: 34.737, lng: 135.342 },
  { id: 'os-amagasaki', label: '尼崎市', lat: 34.733, lng: 135.407 },
  { id: 'ky-uji', label: '宇治市', lat: 34.884, lng: 135.8 },
  { id: 'ng-toyota', label: '豊田市', lat: 35.083, lng: 137.156 },
  { id: 'ng-okazaki', label: '岡崎市', lat: 34.955, lng: 137.173 },
  { id: 'fk-kurume', label: '久留米市', lat: 33.319, lng: 130.508 },
  { id: 'hk-asahikawa', label: '旭川市', lat: 43.7706, lng: 142.365 },
  { id: 'na-naha', label: '那覇市', lat: 26.2124, lng: 127.6811 },
]

export const WALK_AREA_CATALOG: WalkAreaCatalogEntry[] = [
  ...TOKYO23,
  ...TOKYO_TAMA,
  ...KANAGAWA,
  ...SAITAMA_CHIBA,
  ...OTHER_METROS,
  ...(NATIONAL_WALK_AREAS as WalkAreaCatalogEntry[]),
]

const byLabel = new Map(WALK_AREA_CATALOG.map((e) => [e.label, e]))

export function catalogEntryByLabel(label: string): WalkAreaCatalogEntry | undefined {
  return byLabel.get(label.trim())
}

/** 現在地から radiusMeters 以内を距離順で最大 limit 件 */
export function suggestedWalkAreasNear(
  lat: number,
  lng: number,
  radiusMeters = 10_000,
  limit = 40
): WalkAreaCatalogEntry[] {
  return WALK_AREA_CATALOG.map((e) => ({
    e,
    d: distMeters(lat, lng, e.lat, e.lng),
  }))
    .filter((x) => x.d <= radiusMeters)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.e)
}

/** ラベルに query が含まれる候補（最大 limit） */
export function searchWalkAreaCatalog(query: string, limit = 80): WalkAreaCatalogEntry[] {
  const q = query.trim()
  if (!q) return []
  return WALK_AREA_CATALOG.filter((e) => e.label.includes(q)).slice(0, limit)
}
