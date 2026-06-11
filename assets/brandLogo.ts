import type { ImageSourcePropType } from 'react-native'

/**
 * ヘッダー・ログイン等で PNG が必要なときのブランドマーク。
 * マスターは `assets/brand/wanspot-app-icon-1024.png`（App Store 用・ダウンロード可）。
 * アプリ内のヘッダーは `components/Logo`（同一 PNG）を使う。
 */
export const brandLogoSource = require('./images/wanspot_icon_orange.png') as ImageSourcePropType
