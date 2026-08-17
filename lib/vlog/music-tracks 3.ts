export type VlogMusicMood = 'bouncy' | 'cozy' | 'genki'

export type VlogMusicTrack = {
  id: string
  mood: VlogMusicMood
  label: string
  /** 本編開始からのピーク開始ビート（メロディ山） */
  peakOffsetBeats: number
  peakLengthBeats: number
  introBeats: number
  outroBeats: number
}

/** ライセンス済みトラック（明るい系のみ）— URL はレンダラー側で解決 */
export const VLOG_MUSIC_TRACKS: VlogMusicTrack[] = [
  {
    id: 'wanspot_bounce_01',
    mood: 'bouncy',
    label: '跳ね系',
    // 実測(ラウドネス解析): t=31.4〜31.9sのブレイク明け、t≈33.5sでコーラスが立ち上がる。120BPM換算で beat 68 (=34.0s)
    peakOffsetBeats: 68,
    peakLengthBeats: 10,
    introBeats: 8,
    outroBeats: 8,
  },
  {
    id: 'wanspot_cozy_01',
    mood: 'cozy',
    label: 'ほっこり系',
    // 実測(ラウドネス解析): t=17.8s付近でメロウな導入→グルーヴに切り替わる。120BPM換算で beat 36 (=18.0s)
    peakOffsetBeats: 36,
    peakLengthBeats: 8,
    introBeats: 8,
    outroBeats: 8,
  },
  {
    id: 'wanspot_genki_01',
    mood: 'genki',
    label: '元気系',
    // 実測(ラウドネス解析): t=37.2〜38.0sのドロップ明け、t≈38.1sで本サビに入る。120BPM換算で beat 76 (=38.0s)
    peakOffsetBeats: 76,
    peakLengthBeats: 12,
    introBeats: 8,
    outroBeats: 8,
  },
]

export function pickMusicTrack(avgRating: number): VlogMusicTrack {
  if (avgRating >= 4.2) return VLOG_MUSIC_TRACKS.find((t) => t.mood === 'genki')!
  if (avgRating >= 3.2) return VLOG_MUSIC_TRACKS.find((t) => t.mood === 'bouncy')!
  return VLOG_MUSIC_TRACKS.find((t) => t.mood === 'cozy')!
}
