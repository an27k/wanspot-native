import { useCallback, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppHeader } from '@/components/AppHeader'
import { EventEditorForm } from '@/components/events/EventEditorForm'
import { colors } from '@/constants/colors'
import { featureFlags } from '@/lib/feature-flags'

export default function NewEventScreen() {
  const router = useRouter()
  const { connect } = useLocalSearchParams<{ connect?: string }>()
  const connectRaw = Array.isArray(connect) ? connect[0] : connect
  const connectReturn =
    connectRaw === 'success' || connectRaw === 'refresh' ? connectRaw : undefined

  useEffect(() => {
    if (!featureFlags.events) {
      router.replace('/(tabs)/')
    }
  }, [router])

  if (!featureFlags.events) return null

  const onConsumedConnectReturn = useCallback(() => {
    router.replace('/events/new')
  }, [router])

  return (
    <View style={styles.root}>
      <AppHeader variant="back" title="イベントを作成" onBack={() => router.back()} />
      <EventEditorForm
        mode="create"
        connectReturn={connectReturn}
        onConsumedConnectReturn={onConsumedConnectReturn}
        onSuccess={(evId) => router.replace(`/events/${evId}?created=1`)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
})
