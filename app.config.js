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

  const wanspotApiUrl =
    process.env.EXPO_PUBLIC_WANSPOT_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_WANSPOT_API_URL ||
    ''

  const wanspotSiteUrl =
    process.env.EXPO_PUBLIC_WANSPOT_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''

  return {
    ...config,
    plugins: [...(config.plugins ?? []), '@react-native-community/datetimepicker'],
    extra: {
      ...config.extra,
      supabaseUrl,
      supabaseAnonKey,
      wanspotApiUrl,
      wanspotSiteUrl,
    },
  }
}
