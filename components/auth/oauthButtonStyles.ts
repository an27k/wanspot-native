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

/** Google: 白背景＋枠（Apple と border 幅を揃えて同じボックスモデルに） */
export const oauthGooglePressableBase: ViewStyle = {
  ...pressableRow,
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#e0e0e0',
}

/** Apple: 黒背景＋同色の 1px 枠（Google と外寸・内側余白を一致） */
export const oauthApplePressableBase: ViewStyle = {
  ...pressableRow,
  backgroundColor: '#000',
  borderWidth: 1,
  borderColor: '#000',
}
