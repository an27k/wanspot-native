import { type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'

/** Google Chrome 新規タブ風のグラデーション背景 */
export function GoogleHomeBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...GOOGLE_HOME.gradient]}
        locations={[...GOOGLE_HOME.gradientLocations]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
