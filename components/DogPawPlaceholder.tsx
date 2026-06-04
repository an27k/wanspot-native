import Svg, { Ellipse, Path } from 'react-native-svg'

/** 犬の肉球プレースホルダ（写真未設定時などに使用） */
export function DogPawPlaceholder({ size = 40, fill = '#FF8A1F' }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill={fill}>
      <Ellipse cx={20} cy={28} rx={10} ry={13} />
      <Ellipse cx={40} cy={16} rx={10} ry={13} />
      <Ellipse cx={60} cy={16} rx={10} ry={13} />
      <Ellipse cx={80} cy={28} rx={10} ry={13} />
      <Path d="M50 33 C26 33 14 54 17 70 C20 86 35 92 50 92 C65 92 80 86 83 70 C86 54 74 33 50 33Z" />
    </Svg>
  )
}
