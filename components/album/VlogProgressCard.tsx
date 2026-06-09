import { AppState, InteractionManager, StyleSheet, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { VlogGeneratingPanel } from '@/components/album/VlogGeneratingPanel'
import { VlogLiquidGauge, type VlogGaugeMode } from '@/components/album/VlogLiquidGauge'
import { VlogSpotNudgeChip } from '@/components/album/VlogSpotNudgeChip'
import { VlogUnlockPanel } from '@/components/album/VlogUnlockPanel'
import { colors } from '@/constants/colors'
import type { VlogProgress } from '@/lib/album/vlog-progress'
import type { VlogRenderStage } from '@/lib/vlog/render-client'

const CARD_H = 168

type Props = {
  dogName?: string | null
  progress: VlogProgress
  onHelpPress?: () => void
  generating?: boolean
  generationStage?: VlogRenderStage
  generateBusy?: boolean
  onGeneratePress?: () => void
}

function resolveGaugeMode(progress: VlogProgress, generating: boolean): VlogGaugeMode {
  if (generating) return 'generating'
  if (progress.isUnlocked) return 'unlocked'
  if (progress.isNearUnlock) return 'nearUnlock'
  return 'collecting'
}

/** VLOG進捗 — v9.5 液体ゲージ + アンロック/生成中 */
export function VlogProgressCard({
  dogName,
  progress,
  onHelpPress,
  generating = false,
  generationStage = 'selecting',
  generateBusy = false,
  onGeneratePress,
}: Props) {
  const isFocused = useIsFocused()
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [gaugeReady, setGaugeReady] = useState(false)

  const gaugeMode = useMemo(
    () => resolveGaugeMode(progress, generating),
    [progress, generating]
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active')
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!isFocused) {
      setGaugeReady(false)
      return
    }
    const task = InteractionManager.runAfterInteractions(() => {
      setGaugeReady(true)
    })
    return () => task.cancel()
  }, [isFocused])

  if (!gaugeReady) {
    return <View style={styles.placeholder} />
  }

  return (
    <View style={styles.wrap}>
      <VlogLiquidGauge
        fillRatio={progress.progress}
        displayCount={progress.completeUnits}
        max={progress.target}
        dogName={dogName}
        animating={isFocused && appActive}
        gaugeMode={gaugeMode}
        onHelpPress={onHelpPress}
      />

      {!generating && progress.nudgeSpot ? (
        <VlogSpotNudgeChip spotName={progress.nudgeSpot.spotName} />
      ) : null}

      {generating ? (
        <VlogGeneratingPanel stage={generationStage} visible />
      ) : (
        <VlogUnlockPanel
          dogName={dogName ?? '愛犬'}
          visible={progress.isUnlocked}
          busy={generateBusy}
          onPress={() => onGeneratePress?.()}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  placeholder: {
    height: CARD_H,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.vessel,
  },
})
