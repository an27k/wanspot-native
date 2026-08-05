import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DogAlertFace } from '@/components/map/DogAlertFace'
import { WalkAlertModal } from '@/components/map/WalkAlertModal'
import { GoogleGlassPanel } from '@/components/search/GoogleGlassPanel'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { colors } from '@/constants/colors'
import { useWeather } from '@/lib/weather/use-weather'
import { useWalkDailyAdvice } from '@/lib/weather/use-walk-daily-advice'
import { useWalkLine } from '@/lib/weather/use-walk-line'
import { syncWalkAdviceMorningNotification } from '@/lib/notifications/walk-advice-morning'
import { getWalkTimeHour, setWalkTimeHour as persistWalkTimeHour } from '@/lib/weather/walk-time-pref'
import { breedHeatSensitivity } from '@/lib/dog-breeds'
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
  surface = 'glass',
}: {
  location: { lat: number; lng: number } | null
  onRequestLocation?: () => void
  /** glass = グラデ背景用のダークガラス（検索/記事系）、light = 白背景カード（設定タブ） */
  surface?: 'glass' | 'light'
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
    void syncWalkAdviceMorningNotification(dog?.name, {
      location,
      walkHour: walkTimeHour,
      dogBreed: dog?.breed ?? null,
    })
  }, [dog?.name, dog?.breed, location, walkTimeHour, walkTimeLoaded])

  const handleChangeWalkTime = (h: number | null) => {
    setWalkTimeHour(h)
    void persistWalkTimeHour(h)
  }
  const { data: weather, loading: weatherLoading, needsLocation } = useWeather(location)
  const tempC = weather?.tempC ?? null
  // 犬種の暑さ耐性を閾値に効かせる（短頭種は同じ気温でもリスクが高い）
  const baseLevel =
    tempC != null ? walkAlertFromTemp(tempC, { heatSensitivity: breedHeatSensitivity(dog?.breed) }) : null

  const { advice, loading: adviceLoading } = useWalkDailyAdvice(
    location,
    tempC,
    weather?.condition,
    dog?.size ?? null,
    dog?.name ?? null,
    !!location,
    dog?.breed ?? null
  )

  const metaLine = [advice?.dateLabel, advice?.areaLabel].filter(Boolean).join(' · ')
  // 湿度・体感補正後のレベル（advice側）があればバッジ表示もそちらに合わせ、本文とトーンを一致させる
  const level = advice?.levelKey ? walkAlertLevel(advice.levelKey) : baseLevel
  const adviceText = advice?.text ?? level?.advice ?? ''

  // 「今日は何を変えるか」の一言。約9日に1回しか出ない。
  // 出ない日は下のブロックごと消えて、カードは今までと1ピクセルも変わらない。
  const walkLine = useWalkLine(location, level?.key)

  const isLight = surface === 'light'
  const openCard = () => {
    if (needsLocation) onRequestLocation?.()
    setOpen(true)
  }

  const body = (
    <View style={styles.inner}>
          <View style={styles.headRow}>
            <Text style={[styles.kicker, isLight && styles.kickerLight]}>お散歩アラート</Text>
            {metaLine ? <Text style={[styles.meta, isLight && styles.metaLight]}>{metaLine}</Text> : null}
          </View>

          {level ? (
            <View style={styles.bodyRow}>
              <DogAlertFace size={42} level={level.key} ringColor={level.color} tempC={tempC} />
              <View style={styles.bodyCol}>
                <Text style={styles.statusLine}>
                  <Text style={[styles.levelTxt, isLight && styles.levelTxtLight]}>{weatherAwareLabel(level.label, weather?.condition)}</Text>
                  {tempC != null ? <Text style={[styles.tempTxt, isLight && styles.tempTxtLight]}> · 現在{tempC}℃</Text> : null}
                </Text>
                <Text style={[styles.advice, isLight && styles.adviceLight]} numberOfLines={2}>
                  {adviceLoading && !advice ? '今日のお散歩アドバイスを作成中…' : adviceText}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isLight ? '#CCC' : GOOGLE_HOME.textMuted} />
            </View>
          ) : (
            <View style={styles.bodyRow}>
              <DogAlertFace size={42} level="comfortable" ringColor={isLight ? colors.border : 'rgba(255,255,255,0.35)'} />
              <View style={styles.bodyCol}>
                <Text style={[styles.advice, isLight && styles.adviceLight]} numberOfLines={2}>
                  {needsLocation
                    ? '位置情報を許可すると、今日のお散歩予報がここに表示されます'
                    : weatherLoading
                      ? '気温を取得しています…'
                      : '気温を取得できませんでした'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isLight ? '#CCC' : GOOGLE_HOME.textMuted} />
            </View>
      )}

      {/*
        今日の一言。出る日だけ現れる（実測で約9日に1回）。
        上の advice が numberOfLines={2} で詰まっているので、こちらは全幅で独立させる。
        危険レベル以上では useWalkLine が null を返すので、
        「散歩を休む日で正解です」の隣に「舗装の短い側を」が並ぶことはない。
      */}
      {walkLine ? (
        <View style={[styles.walkLineBox, isLight && styles.walkLineBoxLight]}>
          <Text style={[styles.walkLineTxt, isLight && styles.walkLineTxtLight]} numberOfLines={3}>
            {walkLine}
          </Text>
        </View>
      ) : null}
    </View>
  )

  return (
    <>
      {isLight ? (
        <Pressable
          onPress={openCard}
          style={({ pressed }) => [styles.lightShell, pressed && styles.pressedLight]}
          accessibilityRole="button"
        >
          {body}
        </Pressable>
      ) : (
        <GoogleGlassPanel onPress={openCard} style={styles.shell}>
          {body}
        </GoogleGlassPanel>
      )}

      <WalkAlertModal
        dogBreed={dog?.breed ?? null}
        visible={open}
        tempC={tempC}
        currentCondition={weather?.condition}
        loading={weatherLoading}
        needsLocation={needsLocation}
        onRequestLocation={onRequestLocation}
        onClose={() => setOpen(false)}
        dailyAdvice={advice}
        adviceLoading={adviceLoading}
        walkLine={walkLine}
        walkTimeHour={walkTimeHour}
        onChangeWalkTimeHour={handleChangeWalkTime}
      />
    </>
  )
}

const styles = StyleSheet.create({
  shell: { marginBottom: 0 },
  /** 設定タブ用の白背景カード（他タブのリストカードと同じ質感に揃える） */
  lightShell: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pressedLight: { opacity: 0.85 },
  kickerLight: { color: colors.textMuted },
  metaLight: { color: colors.textMuted },
  levelTxtLight: { color: colors.text },
  tempTxtLight: { color: colors.textSecondary },
  adviceLight: { color: colors.textSecondary },
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
  /** 上の行と地続きに見えないよう、細い区切りを入れて独立したブロックにする */
  walkLineBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  walkLineBoxLight: { borderTopColor: colors.border },
  walkLineTxt: { fontSize: 13, lineHeight: 20, fontWeight: '500', color: GOOGLE_HOME.textSecondary },
  walkLineTxtLight: { color: colors.textPrimary },
})
