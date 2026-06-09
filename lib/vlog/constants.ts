/** v9.5 較正パラメータ — 実VLOG数本で更新する */
export const QUALITY_YIELD = 0.55

/** 層2 絶対品質ゲート（YIELD±0.1で救済率が大きく動く） */
export const ABSOLUTE_QUALITY_THRESHOLD = 0.58

export const VLOG_COMPLETION_TARGET = 5
export const MIN_MEDIA_PER_UNIT = 2

export const BEAT_SEC = 0.5
export const BPM = 120

export const INTRO_BEATS = 8
export const OUTRO_BEATS = 8
export const PEAK_LENGTH_BEATS = 10

export const CUT_BEATS_MIN = 2
export const CUT_BEATS_MAX = 3
export const RESCUE_CUT_BEATS = 1.6 // 0.8s = 1.6 beats @ 120bpm

export const DURATION_CLAMP = { min: 10, max: 35 } as const
export const DURATION_FORMULA = { base: 4, perUsable: 1.5, tail: 2 } as const

/** 日記字幕: 全カットの最大比率 */
export const DIARY_CAPTION_MAX_RATIO = 0.4
