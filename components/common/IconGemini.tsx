import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

/** Google Gemini のスパークルマーク（検索タブ AIプラン等） */
export function IconGemini({
  size = 22,
  monochrome,
}: {
  size?: number
  /** 単色（選択中タブの白など）。未指定時は Gemini グラデ */
  monochrome?: string
}) {
  const gradId = monochrome ? undefined : `geminiSparkle-${size}`
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Gemini">
      {gradId ? (
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#4E88FF" />
            <Stop offset="0.45" stopColor="#5EB8FF" />
            <Stop offset="1" stopColor="#9B72FF" />
          </LinearGradient>
        </Defs>
      ) : null}
      <Path
        fill={monochrome ?? `url(#${gradId})`}
        d="M12 2.2 13.8 9.2 20.8 11 13.8 12.8 12 19.8 10.2 12.8 3.2 11 10.2 9.2Z"
      />
    </Svg>
  )
}
