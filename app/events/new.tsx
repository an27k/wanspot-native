import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { AppHeader } from '@/components/AppHeader'
import { EventEditorForm } from '@/components/events/EventEditorForm'
import { colors } from '@/constants/colors'

export default function NewEventScreen() {
  const router = useRouter()
  return (
    <View style={styles.root}>
      <AppHeader variant="back" title="イベント作成" onBack={() => router.back()} />
      <EventEditorForm mode="create" onSuccess={(evId) => router.replace(`/events/${evId}`)} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
})
