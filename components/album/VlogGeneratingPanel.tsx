import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'
import type { VlogRenderStage } from '@/lib/vlog/render-client'
import { VLOG_GENERATION_COPY } from '@/lib/vlog/render-client'

type Props = {
  stage: VlogRenderStage
  visible: boolean
}

/** 生成中 — スピナー/％なし、3段コピーのみ */
export function VlogGeneratingPanel({ stage, visible }: Props) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '…'))
    }, 520)
    return () => clearInterval(id)
  }, [visible])

  if (!visible) return null

  return (
    <View style={styles.wrap}>
      <Text style={styles.copy}>
        {VLOG_GENERATION_COPY[stage]}
        {dots}
      </Text>
      <Text style={styles.hint}>波が編んでいます</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  copy: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
})
