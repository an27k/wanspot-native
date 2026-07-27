import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DogAlertFace } from '@/components/map/DogAlertFace'
import { WalkAlertModal } from '@/components/map/WalkAlertModal'
import { GoogleGlassPanel } from '@/components/search/GoogleGlassPanel'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { useWeather } from '@/lib/weather/use-weather'
import { useWalkDailyAdvice } from '@/lib/weather/use-walk-daily-advice'
import { syncWalkAdviceMorningNotification } from '@/lib/notifications/walk-advice-morning'
import { getWalkTimeHour, setWalkTimeHour as persistWalkTimeHour } from '@/lib/weather/walk-time-pref'
import { walkAlertFromTemp, walkAlertLevel } from '@/lib/weather/walk-alert'
import type { WeatherCondition } from '@/lib/weather/fetch-weather'

function weatherAwareLabel(levelLabel: string, condition: WeatherCondition | null | undefined): string {
  switch (condition) {
    case 'rain':
      return '雨注意'
    case 'thunder':
      return '雷雨注意'
    case 'snow':
      return '雪注意'
    case 'wind':
      return '強風注意'
    default:
      return levelLabel
  }
}

/**
 * 検索タブ上部のお散歩アラートカード（デフォルト表示）。
 * 現在地の気温段階＋今日のアドバイスを開いた瞬間に確認できる。
 * タップで温度ガイド付きの詳細モーダル。
 */
export function WalkAlertCard({
  location,
  onRequestLocation,
}: {
  location: { lat: number; lng: number } | null
  onRequestLocation?: () => void
}) {
  const [open, setOpen] = useState(false)
  const { dog } = useDogProfile()

  /** いつものお散歩時間（null=未設定→朝5:00にきょうのおすすめ、設定あり→2時間前に予定時刻の予測を通知） */
  const [walkTimeHour, setWalkTimeHour] = useState<number | null>(null)
  const [walkTimeLoaded, setWalkTimeLoaded] = useState(false)

  useEffect(() => {
    void getWalkTimeHour().then((h) => {
      setWalkTimeHour(h)
      setWalkTimeLoaded(true)
    })
  }, [])

  // お散歩予報のプッシュ通知を予約する（予報から本文を事前計算・冪等・失敗しても体験は壊さない）
  useEffect(() => {
    if (!walkTimeLoaded) return
    void syncWalkAdviceMorningNotification(dog?.name, { location, walkHour: walkTimeHour })
  }, [dog?.name, location, walkTimeHour, walkTimeLoaded])

  const handleChangeWalkTime = (h: number | null) => {
    setWalkTimeHour(h)
    void persistWalkTimeHour(h)
  }
  const { data: weather, loading: weatherLoading, needsLocation } = useWeather(location)
  const tempC = weather?.tempC ?? null
  const baseLevel = tempC != null ? walkAlertFromTemp(tempC) : null

  const { advice, loading: adviceLoading } = useWalkDailyAdvice(
    location,
    tempC,
    weather?.condition,
    dog?.size ?? null,
    dog?.name ?? null,
    !!location
  )

  const metaLine = [advice?.dateLabel, advice?.areaLabel].filter(Boolean).join(' · ')
  // 湿度・体感補正後のレベル（advice側）があればバッジ表示もそちらに合わせ、本文とトーンを一致させる
  const level = advice?.levelKey ? walkAlertLevel(advice.levelKey) : baseLevel
  const adviceText = advice?.text ?? level?.advice ?? ''

  return (
    <>
      <GoogleGlassPanel
        onPress={() => {
          if (needsLocation) onRequestLocation?.()
          setOpen(true)
        }}
        style={styles.shell}
      >
        <View style={styles.inner}>
          <View style={styles.headRow}>
            <Text style={styles.kicker}>お散歩アラート</Text>
            {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
          </View>

          {level ? (
            <View style={styles.bodyRow}>
              <DogAlertFace size={42} level={level.key} ringColor={level.color} tempC={tempC} />
              <View style={styles.bodyCol}>
                <Text style={styles.statusLine}>
                  <Text style={styles.levelTxt}>{weatherAwareLabel(level.label, weather?.condition)}</Text>
                  {tempC != null ? <Text style={styles.tempTxt}> · 現在{tempC}℃</Text> : null}
                </Text>
                <Text style={styles.advice} numberOfLines={2}>
                  {adviceLoading && !advice ? '今日のお散歩アドバイスを作成中…' : adviceText}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={GOOGLE_HOME.textMuted} />
            </View>
          ) : (
            <View style={styles.bodyRow}>
              <DogAlertFace size={42} level="comfortable" ringColor="rgba(255,255,255,0.35)" />
              <View style={styles.bodyCol}>
                <Text style={styles.advice} numberOfLines={2}>
                  {needsLocation
                    ? '位置情報を許可すると、今日のお散歩予報がここに表示されます'
                    : weatherLoading
                      ? '気温を取得しています…'
                      : '気温を取得できませんでした'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={GOOGLE_HOME.textMuted} />
            </View>
          )}
        </View>
      </GoogleGlassPanel>

      <WalkAlertModal
        visible={open}
        tempC={tempC}
        currentCondition={weather?.condition}
        loading={weatherLoading}
        needsLocation={needsLocation}
        onRequestLocation={onRequestLocation}
        onClose={() => setOpen(false)}
        dailyAdvice={advice}
        adviceLoading={adviceLoading}
        walkTimeHour={walkTimeHour}
        onChangeWalkTimeHour={handleChangeWalkTime}
      />
    </>
  )
}

const styles = StyleSheet.create({
  shell: { marginBottom: 0 },
  inner: { padding: 16, gap: 12 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    color: GOOGLE_HOME.textPrimary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  meta: { fontSize: 11, fontWeight: '500', color: GOOGLE_HOME.textPrimary },
  bodyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bodyCol: { flex: 1, gap: 4, minWidth: 0 },
  statusLine: { flexDirection: 'row', flexWrap: 'wrap' },
  levelTxt: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: GOOGLE_HOME.textPrimary },
  tempTxt: { fontSize: 14, fontWeight: '500', color: GOOGLE_HOME.textPrimary },
  advice: { fontSize: 13, lineHeight: 19, fontWeight: '400', color: GOOGLE_HOME.textSecondary },
})
