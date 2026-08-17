/** Google Maps customMapStyle（JSON・無料）。Map ID / クラウドスタイルは使わない */
export const WANSPOT_GOOGLE_MAP_STYLE_LIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f0' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f0' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e0e0dc' }],
  },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeea' }] },
  // Snapchat ライクに POI のラベル/アイコンを抑えてすっきり見せる
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e3ecd8' }] },
  { featureType: 'poi.park', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#d0d0c8' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fafaf6' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4e4ec' }] },
] as const

/** warm dark: 濃いチャコールの道路・落ち着いた緑の公園・濃紺の水面 */
export const WANSPOT_GOOGLE_MAP_STYLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#1D1B19' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#B8B0A7' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1D1B19' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3B3530' }],
  },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#24211E' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#293A2B' }] },
  { featureType: 'poi.park', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9EAD96' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#302C28' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#171513' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#A39A91' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A342F' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#102638' }] },
] as const

/** @deprecated テーマ未対応の呼び出し元向け。 */
export const WANSPOT_GOOGLE_MAP_STYLE = WANSPOT_GOOGLE_MAP_STYLE_LIGHT
