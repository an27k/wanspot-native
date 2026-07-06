import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'
import { safeToString } from '@/lib/ios-safe-console'

type Props = {
  children: ReactNode
  label?: string
  onRetry?: () => void
}

type State = {
  error: Error | null
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
        <View style={styles.root}>
          <Text style={styles.title}>表示中に問題が発生しました</Text>
          <Text style={styles.body}>もう一度お試しください。</Text>
          {__DEV__ ? (
            <Text style={styles.debug}>
              {this.props.label ?? 'screen'}: {safeToString(this.state.error)}
            </Text>
          ) : null}
          <Pressable style={styles.btn} onPress={this.retry}>
            <Text style={styles.btnTxt}>再読み込み</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.paper,
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  body: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  debug: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  btn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  btnTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
})
