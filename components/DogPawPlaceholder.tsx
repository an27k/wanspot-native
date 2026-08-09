import { IconPaw } from '@/components/IconPaw'
import { useAppTheme } from '@/context/ThemeContext'

/** 犬写真プレースホルダ（SVG のみ — PNG デコード回避） */
export function DogPawPlaceholder({ size = 40, fill }: { size?: number; fill?: string }) {
  const { colors } = useAppTheme()
  return <IconPaw size={size} color={fill ?? colors.dogPhotoPlaceholderPaw} />
}
