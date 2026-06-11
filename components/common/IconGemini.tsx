import Svg, { Path } from 'react-native-svg'
import { colors } from '@/constants/colors'

/** Google Gemini のスパークルマーク（検索タブ AIプラン等）— restraint v8: 単色 primary */
export function IconGemini({
  size = 22,
  monochrome,
}: {
  size?: number
  /** 単色（選択中タブの白など）。未指定時は primary */
  monochrome?: string
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Gemini">
      <Path
        fill={monochrome ?? colors.primary}
        d="M12 2.2 13.8 9.2 20.8 11 13.8 12.8 12 19.8 10.2 12.8 3.2 11 10.2 9.2Z"
      />
    </Svg>
  )
}
