import type { ImageSourcePropType } from 'react-native'

/**
 * ヘッダー・ログイン等で共通のブランドマーク。
 * PNG の中身だけ差し替えたときに古い絵のままになる場合は `npx expo start -c` でキャッシュを消してください。
 */
export const brandLogoSource = require('./images/wanspot_image.png') as ImageSourcePropType
