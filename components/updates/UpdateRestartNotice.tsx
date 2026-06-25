import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Updates from 'expo-updates'
import Ionicons from '@expo/vector-icons/Ionicons'

type NoticeState = 'hidden' | 'checking' | 'ready' | 'restarting' | 'error'

export function UpdateRestartNotice() {
  const [noticeState, setNoticeState] = useState<NoticeState>('hidden')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const checkForUpdate = async () => {
      if (__DEV__ || !Updates.isEnabled) return

      try {
        const check = await Updates.checkForUpdateAsync()
        if (cancelled || !check.isAvailable) return

        setNoticeState('checking')
        const fetched = await Updates.fetchUpdateAsync()
        if (cancelled) return

        if (fetched.isNew) {
          setNoticeState('ready')
        } else {
          setNoticeState('hidden')
        }
      } catch {
        if (!cancelled) {
          setNoticeState('error')
          timerRef.current = setTimeout(() => setNoticeState('hidden'), 3600)
        }
      }
    }

    timerRef.current = setTimeout(checkForUpdate, 1400)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const restart = async () => {
    if (noticeState !== 'ready') return
    try {
      setNoticeState('restarting')
      await Updates.reloadAsync()
    } catch {
      setNoticeState('ready')
    }
  }

  if (noticeState === 'hidden') return null

  const isBusy = noticeState === 'checking' || noticeState === 'restarting'
  const title =
    noticeState === 'ready'
      ? 'アップデート準備完了'
      : noticeState === 'error'
        ? '更新確認に失敗しました'
        : noticeState === 'restarting'
          ? '再起動しています'
          : 'アップデートを確認中'
  const message =
    noticeState === 'ready'
      ? '再起動すると最新デザインに切り替わります。'
      : noticeState === 'error'
        ? '通信状態を確認して、次回起動時に再試行します。'
        : '最新バージョンを読み込んでいます。'

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <LinearGradient colors={['#55E0B4', '#7F5CFF', '#F27AD7']} style={styles.card}>
        <View style={styles.glassTubeTop} />
        <View style={styles.glassTubeBottom} />
        <View style={styles.iconWrap}>
          {isBusy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name={noticeState === 'error' ? 'cloud-offline-outline' : 'sparkles'} color="#FFFFFF" size={18} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        {noticeState === 'ready' ? (
          <Pressable onPress={restart} style={({ pressed }) => [styles.restartBtn, pressed && styles.restartBtnPressed]}>
            <Text style={styles.restartText}>再起動</Text>
          </Pressable>
        ) : null}
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
