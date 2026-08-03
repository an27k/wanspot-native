import Svg, { Circle, Path, Rect } from 'react-native-svg'

type Props = {
  size?: number
}

/** Google Maps アプリアイコン相当（ローカル PNG / expo-image に依存しない）。 */
export function IconGoogleMaps({ size = 20 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Google Maps">
      <Rect x={2} y={2} width={44} height={44} rx={10} fill="#E8F0FE" />
      <Path d="M2 14h18L8 46H2V14z" fill="#34A853" />
      <Path d="M20 2h18l-12 44H8L20 2z" fill="#FBBC05" />
      <Path d="M38 2h8v32L28 46 38 2z" fill="#4285F4" />
      <Path
        d="M30 6c-5.5 0-10 4.4-10 9.8 0 7.2 10 17.2 10 17.2s10-10 10-17.2C40 10.4 35.5 6 30 6z"
        fill="#EA4335"
      />
      <Circle cx={30} cy={16} r={4.2} fill="#B31412" />
      <Circle cx={30} cy={16} r={2.2} fill="#fff" />
    </Svg>
  )
}
