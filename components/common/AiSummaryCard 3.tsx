import { useState } from 'react'
import { WanspotIconPaw } from '@/components/icons/WanspotIconPaw'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'

/**
 * ワンスポAIレビューのカード（コーラル薄面・タップで展開）。
 * デザインはスポット詳細の「ワンスポAIレビュー」カードと同一仕様（Webのスポット詳細とも共通）。
 * スポット詳細・カレンダーイベント詳細の2箇所から利用する。
 */
export function AiSummaryCard({
  heading,
  body,
  keywords = [],
  collapsedLines = 2,
}: {
  heading: string
  body: string
  keywords?: string[]
  /** 折りたたみ時の行数。0以下で常時全文表示 */
  collapsedLines?: number
}) {
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const [expanded, setExpanded] = useState(false)
  const collapsible = collapsedLines > 0

  return (
    <View style={styles.aiCard}>
      <Pressable onPress={collapsible ? () => setExpanded((v) => !v) : undefined}>
        {/* 絵文字は iOS の標準UIに出てこない。スポット詳細と同じ肉球アイコンに揃える */}
        <View style={styles.aiHeadRow}>
          <WanspotIconPaw size={13} color={colors.pillText} />
          <Text style={styles.aiHead}>{heading}</Text>
        </View>
        {keywords.length > 0 ? (
          <View style={styles.kwRow}>
            {keywords.map((tag) => (
              <View key={tag} style={styles.kwPill}>
                <Text style={styles.kwTxt} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.aiBody} numberOfLines={collapsible && !expanded ? collapsedLines : undefined}>
          {body}
        </Text>
        {collapsible && !expanded ? <Text style={styles.aiExpandHint}>タップで続きを読む</Text> : null}
      </Pressable>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  aiCard: {
    backgroundColor: colors.tintWeak,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.tintStrong,
  },
  aiHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiHead: { ...type.label, color: colors.pillText },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kwPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '100%',
  },
  kwTxt: { ...type.label, color: colors.pillText },
  aiBody: { ...type.body, color: colors.text },
  aiExpandHint: { ...type.label, marginTop: 6, color: colors.textSecondary },
})
