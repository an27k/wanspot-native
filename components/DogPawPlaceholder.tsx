import { IconPaw } from '@/components/IconPaw'
import { colors } from '@/constants/colors'

/** 犬写真プレースホルダ（SVG のみ — PNG デコード回避） */
export function DogPawPlaceholder({ size = 40, fill = colors.dogPhotoPlaceholderPaw }: { size?: number; fill?: string }) {
  return <IconPaw size={size} color={fill} />
}
