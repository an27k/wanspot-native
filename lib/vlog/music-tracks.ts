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
    peakOffsetBeats: 24,
    peakLengthBeats: 10,
    introBeats: 8,
    outroBeats: 8,
  },
  {
    id: 'wanspot_cozy_01',
    mood: 'cozy',
    label: 'ほっこり系',
    peakOffsetBeats: 28,
    peakLengthBeats: 8,
    introBeats: 8,
    outroBeats: 8,
  },
  {
    id: 'wanspot_genki_01',
    mood: 'genki',
    label: '元気系',
    peakOffsetBeats: 20,
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
