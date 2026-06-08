import { StyleSheet } from 'react-native'
import { BrandGradient } from '@/components/common/BrandGradient'

const COVER_H = 128

/** レビュータブ プロフィール上部カバー（BrandGradient） */
export function AlbumCoverGradient() {
  return <BrandGradient style={styles.wrap} />
}

const styles = StyleSheet.create({
  wrap: { height: COVER_H },
})
