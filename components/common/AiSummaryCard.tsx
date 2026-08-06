import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'
import { type } from '@/constants/typography'

/**
 * AIまとめカード（コーラル薄面・タップで展開）。
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
  const [expanded, setExpanded] = useState(false)
  const collapsible = collapsedLines > 0

  return (
    <View style={styles.aiCard}>
      <Pressable onPress={collapsible ? () => setExpanded((v) => !v) : undefined}>
        <Text style={styles.aiHead}>{heading}</Text>
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

const styles = StyleSheet.create({
  aiCard: {
    backgroundColor: 'rgba(251,107,83,0.07)',
    borderRadius: 16,
    padding: 14,
  },
  aiHead: { ...type.label, color: '#C24B36', marginBottom: 8 },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kwPill: {
    backgroundColor: TOKENS.surface.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '100%',
  },
  kwTxt: { ...type.label, color: '#C24B36' },
  aiBody: { ...type.body, color: TOKENS.text.primary },
  aiExpandHint: { ...type.label, marginTop: 6, color: TOKENS.text.secondary },
})
