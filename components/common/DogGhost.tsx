import { DogFaceMark } from '@/components/common/DogFaceMark'

/** @deprecated 互換用。新デザインの犬顔マークへ委譲 */
export const WANSPOT_MASCOT_ORANGE = '#FDCB2E'

/** 犬顔マスコット（ロゴ・プレースホルダ等で共通） */
export function DogGhost({
  size = 64,
  muted = false,
  showSparkles = false,
}: {
  size?: number
  /** 空状態などグレー表示 */
  muted?: boolean
  showSparkles?: boolean
  /** @deprecated 未使用 */
  fill?: string
  /** @deprecated 未使用 */
  featureColor?: string
  /** @deprecated 未使用 */
  withBackground?: boolean
}) {
  return <DogFaceMark size={size} muted={muted} showSparkles={showSparkles} />
}

/** @deprecated DogFaceMark を直接使用してください */
export function DogGhostShape() {
  return null
}
