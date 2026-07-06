module.exports = ({ config }) => {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''

  const prodOrigin = 'https://www.wanspot.app'
  const wanspotApiUrl =
    process.env.EXPO_PUBLIC_WANSPOT_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_WANSPOT_API_URL ||
    prodOrigin

  const wanspotSiteUrl =
    process.env.EXPO_PUBLIC_WANSPOT_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    prodOrigin

  const amplitudeApiKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY || ''
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  const googleMapsAndroidApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || googleMapsApiKey
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ''

  const adsEnabled =
    process.env.EXPO_PUBLIC_ADS_ENABLED === 'true' || process.env.EXPO_PUBLIC_ADS_ENABLED === '1'

  const plugins = (config.plugins ?? [])
    .filter((entry) => {
      if (adsEnabled) return true
      const name = Array.isArray(entry) ? entry[0] : entry
      return name !== 'react-native-google-mobile-ads'
    })
    .map((entry) => {
      if (entry === 'react-native-maps') {
        return [
          'react-native-maps',
          {
            iosGoogleMapsApiKey: googleMapsApiKey,
            androidGoogleMapsApiKey: googleMapsAndroidApiKey,
          },
        ]
      }
      return entry
    })

  return {
    ...config,
    plugins: [...plugins, 'expo-image', 'expo-video'],
    extra: {
      ...config.extra,
      supabaseUrl,
      supabaseAnonKey,
      wanspotApiUrl,
      wanspotSiteUrl,
      amplitudeApiKey,
      googleMapsApiKey,
      googleMapsAndroidApiKey,
      googleWebClientId,
    },
  }
}
