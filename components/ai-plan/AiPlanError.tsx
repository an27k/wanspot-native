import { Pressable, StyleSheet, Text, View } from 'react-native'

export function AiPlanError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>生成に失敗しました</Text>
        <Text style={styles.msg}>{message}</Text>
        <Pressable style={styles.btn} onPress={onBack}>
          <Text style={styles.btnTxt}>戻る</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3', padding: 16, justifyContent: 'center' },
  card: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', padding: 16, gap: 12 },
  title: { fontSize: 16, fontWeight: '900', color: '#2b2a28' },
  msg: { fontSize: 13, color: '#666', lineHeight: 19 },
  btn: { marginTop: 4, borderRadius: 16, backgroundColor: '#FFD84D', paddingVertical: 14, alignItems: 'center' },
  btnTxt: { fontSize: 14, fontWeight: '900', color: '#2b2a28' },
})
