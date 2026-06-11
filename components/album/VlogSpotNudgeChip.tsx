import { StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'

type Props = {
  spotName: string
}

/** 部分溜まり促し — ゲージ下の黒丸薬チップ */
export function VlogSpotNudgeChip({ spotName }: Props) {
  return (
    <View style={styles.chip}>
      <Text style={styles.txt} numberOfLines={1}>
        {spotName}：
        <Text style={styles.gold}>あと1枚</Text>
        で1スポット完成
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '100%',
  },
  txt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  gold: {
    color: TOKENS.brand.gold,
    fontWeight: '800',
  },
})
