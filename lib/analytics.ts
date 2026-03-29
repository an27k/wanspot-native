import * as amplitude from '@amplitude/analytics-react-native'
import Constants from 'expo-constants'

function getApiKey(): string {
  const extra = Constants.expoConfig?.extra as { amplitudeApiKey?: string } | undefined
  const fromEnv = typeof process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY === 'string'
    ? process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY.trim()
    : ''
  const fromExtra = typeof extra?.amplitudeApiKey === 'string' ? extra.amplitudeApiKey.trim() : ''
  return fromEnv || fromExtra
}

export const initAnalytics = () => {
  const apiKey = getApiKey()
  if (!apiKey) return
  amplitude.init(apiKey, undefined, {
    trackingOptions: { ipAddress: false },
  })
}

export const track = (event: string, props?: Record<string, unknown>) => {
  amplitude.track(event, props)
}
