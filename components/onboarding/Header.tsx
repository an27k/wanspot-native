import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'

export function Header({ progress, total }: { progress: number; total: number }) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.logoRow}>
        <Image source={require('@/assets/icon.png')} style={styles.logo} />
        <Text style={styles.appName}>wanspot</Text>
      </View>
      <View style={styles.progressDots}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.dot, i < progress && styles.dotActive]} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 26, height: 26, borderRadius: 6 },
  appName: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  progressDots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0E0E0' },
  dotActive: { backgroundColor: '#FFC107' },
})

