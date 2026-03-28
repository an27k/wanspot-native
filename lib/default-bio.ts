/**
 * オンボーディング・マイページで共通の「自己紹介の提案文」
 * dogName / breed が空のときは「愛犬と〜」にフォールバック
 */
export type DogBioSource = {
  name?: string | null
  breed?: string | null
}

export function defaultBioFromDog(dog: DogBioSource): string {
  const dogName = typeof dog.name === 'string' ? dog.name.trim() : ''
  const breed = typeof dog.breed === 'string' ? dog.breed.trim() : ''
  if (!dogName) return '愛犬と一緒に新しいスポットを探しています！'
  if (breed) return `${dogName}（${breed}）と一緒に新しいスポットを探しています！`
  return `${dogName}と一緒に新しいスポットを探しています！`
}
