/** オンボーディング完了直後に1回だけ表示するチュートリアル用フラグ（インメモリ。再起動で消える） */
export const POST_ONBOARDING_TUTORIAL_KEY = 'post_onboarding_tutorial_hint'

/** オンボーディング中の一時的な現在地（散歩エリア候補の基準） */
export const OB_LOCATION_KEY = 'ob_location'

/** オンボーディング AsyncStorage: 愛犬入力（サイズ・ワクチン含む） */
export const OB_DOG_KEY = 'ob_dog'

/** オンボーディング ステップ数（位置 → 愛犬 → 散歩エリア） */
export const ONBOARDING_TOTAL_STEPS = 3
