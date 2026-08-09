import { useMemo } from 'react'
import type { AppColors } from '@/constants/colors'
import { useAppTheme } from '@/context/ThemeContext'

/**
 * モジュールスコープの createStyles をテーマ切替時だけ再評価する。
 * factory はコンポーネント外で定義し、参照を安定させること。
 */
export function useThemedStyles<T>(factory: (colors: AppColors) => T): T {
  const { colors } = useAppTheme()
  return useMemo(() => factory(colors), [colors, factory])
}
