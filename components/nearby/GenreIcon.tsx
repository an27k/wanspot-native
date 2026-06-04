import { Ionicons } from '@expo/vector-icons'
import Svg, { Rect } from 'react-native-svg'
import { MAP_GENRE_CHIPS, type MapGenreKey } from '@/lib/nearby/constants'

/** 公園はベンチのオリジナル SVG、その他は Ionicons で統一表示する。 */
export function GenreIcon({
  genre,
  size = 20,
  color = '#2b2a28',
}: {
  genre: MapGenreKey
  size?: number
  color?: string
}) {
  if (genre === 'park') return <BenchIcon size={size} color={color} />
  const def = MAP_GENRE_CHIPS.find((g) => g.key === genre) ?? MAP_GENRE_CHIPS[0]
  return <Ionicons name={def.icon as keyof typeof Ionicons.glyphMap} size={size} color={color} />
}

function BenchIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {/* 背もたれの支柱 */}
      <Rect x={3} y={6} width={2} height={9} rx={1} />
      <Rect x={19} y={6} width={2} height={9} rx={1} />
      {/* 背もたれの板 */}
      <Rect x={3} y={6} width={18} height={2} rx={1} />
      <Rect x={3} y={9} width={18} height={1.8} rx={0.9} />
      {/* 座面 */}
      <Rect x={2.4} y={12.6} width={19.2} height={2.4} rx={1.2} />
      {/* 脚 */}
      <Rect x={4} y={15} width={2} height={4.6} rx={1} />
      <Rect x={18} y={15} width={2} height={4.6} rx={1} />
    </Svg>
  )
}
