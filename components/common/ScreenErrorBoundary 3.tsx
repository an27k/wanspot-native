import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { safeToString } from '@/lib/ios-safe-console'

type Props = {
  children: ReactNode
  label?: string
  onRetry?: () => void
}

type State = {
  error: Error | null
}

function ScreenErrorFallback({
  error,
  label,
  onRetry,
}: {
  error: Error
  label?: string
  onRetry: () => void
}) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.root}>
      <Text style={styles.title}>表示中に問題が発生しました</Text>
      <Text style={styles.body}>もう一度お試しください。</Text>
      <Text style={styles.debug}>
        {label ?? 'screen'}: {safeToString(error)}
      </Text>
      <Pressable style={styles.btn} onPress={onRetry}>
        <Text style={styles.btnTxt}>再読み込み</Text>
      </Pressable>
    </View>
  )
}

/** JS 例外でアプリ全体を落とさずフォールバック UI を出す */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? 'screen'
    const name = error instanceof Error && error.name ? error.name : 'Error'
    const msg = safeToString(error)
    const stack = typeof info.componentStack === 'string' ? info.componentStack : ''
    console.error(`[ScreenErrorBoundary:${label}] ${name}: ${msg}${stack ? ` ${stack}` : ''}`)
  }

  private retry = () => {
    this.setState({ error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.error) {
      return (
        <ScreenErrorFallback
          error={this.state.error}
          label={this.props.label}
          onRetry={this.retry}
        />
      )
    }
    return this.props.children
  }
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.paper,
    gap: 12,
  },
  title: { ...type.heading, color: colors.textPrimary, textAlign: 'center' },
  body: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  // 原因のラベルとエラー文字列。読ませるが主役ではないので補足サイズ
  debug: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  btn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  btnTxt: { ...type.button, color: colors.onPrimary },
})
