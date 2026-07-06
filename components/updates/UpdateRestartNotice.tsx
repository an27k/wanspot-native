import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Updates from 'expo-updates'
import Ionicons from '@expo/vector-icons/Ionicons'

/**
 * OTA 更新の適用案内。
 *
 * `checkAutomatically: ON_ERROR_RECOVERY` — 起動直後の OTA 適用で壊れたバンドルが当たるループを避ける。
 * バックグラウンド取得済みの更新は `useUpdates().isUpdatePending` で検知し、
 * ユーザーには完全終了→再起動を案内する（`EXUpdatesLaunchWaitMs: 0` 構成ではこちらが安全）。
 *
 * `Updates.reloadAsync()` は呼ばない。reload 直前の setState やナビゲーション中の bridge 再生成と競合し、
 * iOS のクラッシュ判定を誘発しやすいため。
 */
export function UpdateRestartNotice() {
  const { isUpdatePending } = Updates.useUpdates()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!isUpdatePending) setDismissed(false)
  }, [isUpdatePending])

  if (__DEV__ || !Updates.isEnabled || dismissed || !isUpdatePending) return null

  const dismiss = () => {
    setDismissed(true)
  }

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <LinearGradient colors={['#55E0B4', '#7F5CFF', '#F27AD7']} style={styles.card}>
        <View style={styles.glassTubeTop} />
        <View style={styles.glassTubeBottom} />
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" color="#FFFFFF" size={18} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>アップデート準備完了</Text>
          <Text style={styles.message}>
            アプリを完全終了（App Switcher から上にスワイプ）して、再度開くと最新版に切り替わります。
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          style={({ pressed }) => [styles.restartBtn, pressed && styles.restartBtnPressed]}
          accessibilityLabel="了解"
        >
          <Text style={styles.restartText}>了解</Text>
        </Pressable>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 58,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  card: {
    minHeight: 74,
    borderRadius: 24,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  glassTubeTop: {
    position: 'absolute',
    top: 8,
    left: 40,
    right: 24,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    opacity: 0.78,
  },
  glassTubeBottom: {
    position: 'absolute',
    bottom: 8,
    left: 110,
    right: -16,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  message: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  restartBtn: {
    minWidth: 72,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  restartBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  restartText: {
    color: '#5D38D7',
    fontSize: 12,
    fontWeight: '900',
  },
})
