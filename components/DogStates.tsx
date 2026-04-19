import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LoadingDogSvg } from '@/components/common/LoadingDog'
import { IconPaw } from '@/components/IconPaw'

export const RunningDog = ({ label = '読み込み中...' }: { label?: string }) => (
  <View style={styles.runWrap}>
    <LoadingDogSvg />
    <Text style={styles.runLabel}>{label}</Text>
  </View>
)

export const PowState = ({
  label = '見つかりませんでした',
  onRetry,
}: {
  label?: string
  onRetry?: () => void
}) => (
  <View style={styles.runWrap}>
    <IconPaw size={40} color="#aaa" />
    <Text style={styles.powLabel}>{label}</Text>
    {onRetry ? (
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.retryTxt}>もう一度検索する</Text>
      </TouchableOpacity>
    ) : null}
  </View>
)

const styles = StyleSheet.create({
  runWrap: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  runLabel: { fontSize: 12, color: '#aaa' },
  powLabel: { fontSize: 14, color: '#aaa' },
  retryBtn: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ebebeb',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
})
