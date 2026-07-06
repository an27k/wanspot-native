import { View } from 'react-native'
import { REVIEW_ALBUM_TAB_ENABLED } from '@/lib/feature-flags'

/**
 * レビューアルバムタブのルート。
 * REVIEW_ALBUM_TAB_ENABLED=false の間は Skia / expo-video 等の重い依存を
 * バンドル・マウントしないようスタブのみ返す。
 * 復旧時は下記 require を有効化する。
 */
export default function CameraTabRoute() {
  if (!REVIEW_ALBUM_TAB_ENABLED) {
    return <View style={{ flex: 1 }} />
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReviewAlbumTabScreen = require('@/components/review/ReviewAlbumTabScreen').default
  return <ReviewAlbumTabScreen />
}
