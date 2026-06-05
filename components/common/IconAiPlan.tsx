import Svg, { G, Path } from 'react-native-svg'

function Sparkle({ x, y, scale, fill }: { x: number; y: number; scale: number; fill: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path
        fill={fill}
        d="M12 2.2 13.8 9.2 20.8 11 13.8 12.8 12 19.8 10.2 12.8 3.2 11 10.2 9.2Z"
      />
    </G>
  )
}

/**
 * 検索タブ「AIプラン」用：横顔シルエット＋頭内スパークル。
 * 他チップと同様 fill=#888（未選択）/ #fff（選択中）。
 */
export function IconAiPlan({ fill }: { fill: string }) {
  const sparkleFill = fill === '#fff' ? 'rgba(26,26,26,0.38)' : '#ffffff'
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" accessibilityLabel="AIプラン">
      <Path
        fill={fill}
        d="M5.2 20.2h4.1c1.8 0 3.1-0.7 4-1.8 0.9-1.1 1.6-2.6 2.1-4.1 0.5-1.4 0.9-2.8 1.1-4 0.2-1.3 0.1-2.6-0.5-3.7-0.6-1.1-1.7-2-3.1-2.4-1.3-0.4-2.8-0.3-4 0.3-1.3 0.6-2.4 1.6-3.1 2.9-0.7 1.2-1.1 2.7-1.2 4.2-0.1 1.6 0.1 3.2 0.7 4.5 0.5 1.1 1.3 2 2.3 2.6 0.5 0.3 1.1 0.5 1.6 0.5z"
      />
      <Sparkle x={6.2} y={4.8} scale={0.28} fill={sparkleFill} />
      <Sparkle x={10.8} y={8.2} scale={0.2} fill={sparkleFill} />
    </Svg>
  )
}
