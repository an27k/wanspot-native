/** オンボーディング完了直後に1回だけ表示するチュートリアル用フラグ（インメモリ。再起動で消える） */
export const POST_ONBOARDING_TUTORIAL_KEY = 'post_onboarding_tutorial_hint'

/** オンボーディング完了済みユーザーの起動ゲート短縮用フラグ */
export const ONBOARDING_COMPLETE_KEY = 'onboarding_complete_v1'

/** オンボーディング中の一時的な現在地（散歩エリア候補の基準） */
export const OB_LOCATION_KEY = 'ob_location'

/** 位置情報許可結果: '1'=許可, '0'=拒否/スキップ */
export const OB_LOCATION_GRANTED = 'ob_location_granted'

/** オンボーディング AsyncStorage: 愛犬入力（サイズ・ワクチン含む） */
export const OB_DOG_KEY = 'ob_dog'

/**
 * オンボーディング AsyncStorage: 選んだ散歩エリア。
 * エリア選択と完了処理のあいだに締めの画面を挟むので、選択結果を一度置いておく。
 */
export const OB_WALK_AREA_TAGS_KEY = 'ob_walk_area_tags'

/**
 * オンボーディング ステップ数（愛犬 → どこで探すか）。
 *
 * 2段目の「どこで探すか」は、位置情報を許可すれば location 画面で、
 * 断れば area 画面（散歩エリア選択）で満たされる。どちらも 2/2 として見せるので、
 * 断ったときに進捗が増えて「終わらない」印象になることがない。
 */
export const ONBOARDING_TOTAL_STEPS = 2
