import { Ionicons } from '@expo/vector-icons'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { track } from '@/lib/analytics'
import { TOKENS } from '@/constants/color-tokens'

const INSURANCE_AFFILIATE_URL =
  process.env.EXPO_PUBLIC_INSURANCE_AFFILIATE_URL || 'https://px.a8.net/svt/ejp?a8mat=XXXX'

type Props = {
  planId?: string | null
}

export function AiPlanInsuranceBanner({ planId }: Props) {
  const handlePress = async () => {
    track('insurance_banner_clicked', {
      location: 'ai_plan_result',
      plan_id: planId ?? undefined,
    })
    try {
      await Linking.openURL(INSURANCE_AFFILIATE_URL)
    } catch (e) {
      console.error('Failed to open insurance URL:', e)
    }
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <View style={styles.prLabel}>
        <Text style={styles.prLabelText}>PR</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={22} color="#E8B800" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>お出かけ先でも安心</Text>
          <Text style={styles.subtitle}>ワンちゃんのペット保険を探す</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={TOKENS.text.tertiary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 14,
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5E6A0',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  prLabel: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: TOKENS.text.tertiary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prLabelText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    marginLeft: 0,
    paddingRight: 36,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.surface.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: TOKENS.text.secondary,
  },
})
