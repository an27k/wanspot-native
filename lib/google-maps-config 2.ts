import Constants from 'expo-constants'

type Extra = {
  googleMapsApiKey?: string
  googleMapsAndroidApiKey?: string
}

export function getGoogleMapsIosApiKey(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || extra?.googleMapsApiKey || '').trim()
}

export function getGoogleMapsAndroidApiKey(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
    extra?.googleMapsAndroidApiKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    extra?.googleMapsApiKey ||
    ''
  ).trim()
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsIosApiKey().length > 0 || getGoogleMapsAndroidApiKey().length > 0
}
