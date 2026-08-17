/**
 * 共有キット — バイラルエンジン側のロジック（P1/P5/P7 のメタデータ部分）。
 * 完成VLOGに添えるキャプション・ハッシュタグ・ウォーターマーク・イントロ/アウトロ
 * カードの仕様を組み立てる。SetLog の E5（外部SNSへの書き出しが拡散の本体）:
 * 「#setlog 転載」に相当する固有の見た目と定型タグをここで担保する。
 * 純関数のみ。レンダラー（FFmpeg）とUIはこの仕様を消費するだけにする。
 */
import { calcDogAge, type DogProfile } from '@/lib/dog-display'
import type { VlogEpisode } from '@/lib/vlog-auto/episode'

export type VlogIntroCardSpec = {
  /** 犬プロフィールカード演出（P5）。photoUrl が null ならプレースホルダ肉球 */
  dogName: string
  dogPhotoUrl: string | null
  /** 例: 3歳2ヶ月 */
  ageLabel: string | null
  breed: string | null
  /** 例: きょうのモカ / 6月のおでかけ */
  title: string
  /** 例: 2026.07.08 / 2026.07.06 - 07.12 */
  dateLabel: string
}

export type VlogOutroCardSpec = {
  appName: 'wanspot'
  message: string
  /** ストア誘導表記。QR等の実装はレンダラー側 */
  cta: string
}

export type VlogWatermarkSpec = {
  /** 右下焼き込み想定の短文（例: wanspot · モカ 🐾） */
  text: string
  position: 'bottom-right'
  opacity: number
}

export type VlogShareKit = {
  /** OS共有シート・SNS投稿にプリセットするキャプション */
  caption: string
  /** # なしのタグ配列（表示時に # を付ける） */
  hashtags: string[]
  watermark: VlogWatermarkSpec
  intro: VlogIntroCardSpec
  outro: VlogOutroCardSpec
}

const BASE_HASHTAGS = ['wanspot', '犬のいる暮らし', 'いぬすたぐらむ', '犬とおでかけ']

/** ハッシュタグに使えない空白・記号を除去 */
function toHashtag(raw: string): string {
  return raw.replace(/[\s#・、。()（）!！?？/／]/g, '')
}

function formatDateLabel(fromKey: string, toKey: string): string {
  const from = fromKey.replaceAll('-', '.')
  if (fromKey === toKey) return from
  return `${from} - ${toKey.slice(5).replaceAll('-', '.')}`
}

/** エピソード内の代表スポット名（ユニーク・出現順・最大N件） */
export function pickSpotNames(episode: VlogEpisode, max = 2): string[] {
  const names: string[] = []
  for (const plate of episode.plates) {
    if (plate.spot_id == null) continue // 日次ログはスポット名に数えない
    const name = plate.spot.name.trim()
    if (name && !names.includes(name)) names.push(name)
    if (names.length >= max) break
  }
  return names
}

function buildCaption(episode: VlogEpisode, dogName: string): string {
  const spots = pickSpotNames(episode)
  switch (episode.kind) {
    case 'daily':
      return spots.length > 0
        ? `きょうは${dogName}と${spots.join('と')}へ 🐾`
        : `きょうの${dogName}の記録 🐾`
    case 'weekly':
      return `今週の${dogName} 🐾`
    case 'monthly':
      return `${episode.title.replace('のおでかけ', '')}の${dogName}まとめ 🐾`
    case 'anniversary':
      return spots.length > 0
        ? `${episode.title}、${dogName}と${spots[0]}に行った日 🐾`
        : `${episode.title}の${dogName} 🐾`
    case 'event':
      return `${episode.title}に${dogName}と参加してきました 🐾`
  }
}

export function buildVlogShareKit(input: {
  episode: VlogEpisode
  dog: Pick<DogProfile, 'name' | 'breed' | 'birthday' | 'photo_url'>
}): VlogShareKit {
  const { episode, dog } = input
  const dogName = dog.name?.trim() || 'うちの子'

  const hashtags = [...BASE_HASHTAGS]
  if (dog.breed?.trim()) hashtags.push(toHashtag(dog.breed))
  if (episode.event?.hashtag) hashtags.push(toHashtag(episode.event.hashtag))

  return {
    caption: buildCaption(episode, dogName),
    hashtags,
    watermark: {
      text: `wanspot · ${dogName} 🐾`,
      position: 'bottom-right',
      opacity: 0.75,
    },
    intro: {
      dogName,
      dogPhotoUrl: dog.photo_url,
      ageLabel: dog.birthday?.trim() ? calcDogAge(dog.birthday) : null,
      breed: dog.breed,
      title: episode.title,
      dateLabel: formatDateLabel(episode.fromDateKey, episode.toDateKey),
    },
    outro: {
      appName: 'wanspot',
      message: `${dogName}のおでかけ記録は wanspot で`,
      cta: 'App Store で「wanspot」',
    },
  }
}
