import type { ViewStyle } from 'react-native'

/** ログイン・新規登録の Google/Apple ボタン共通（横幅いっぱい・中央寄せ・同一パディング） */
export const OAUTH_BTN_PADDING_H = 16
export const OAUTH_BTN_PADDING_V = 14

const pressableRow: ViewStyle = {
  alignSelf: 'stretch',
  paddingHorizontal: OAUTH_BTN_PADDING_H,
  paddingVertical: OAUTH_BTN_PADDING_V,
  borderRadius: 16,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
}

/** Google / Apple 共通: 黒背景・同色枠（Apple HIG 準拠） */
export const oauthProviderPressableBase: ViewStyle = {
  ...pressableRow,
  backgroundColor: '#000',
  borderWidth: 1,
  borderColor: '#000',
}

export const oauthGooglePressableBase = oauthProviderPressableBase
export const oauthApplePressableBase = oauthProviderPressableBase

/** OAuth ボタン文言（白・同一） */
export const oauthProviderTextStyle = {
  fontWeight: '800' as const,
  fontSize: 16,
  color: '#fff',
}
