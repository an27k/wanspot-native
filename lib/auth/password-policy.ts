/** Supabase Auth のパスワード強度設定と揃える。画面には記号一覧を出さない。 */
export const PASSWORD_MIN_LENGTH = 12

export const PASSWORD_HINT =
  '12文字以上。英大文字・英小文字・数字・記号をそれぞれ1文字以上'

const LOWER = /[a-z]/
const UPPER = /[A-Z]/
const DIGIT = /[0-9]/
const SYMBOL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/

export const PASSWORD_POLICY_MESSAGE =
  'パスワードは12文字以上で、英大文字・英小文字・数字・記号をそれぞれ1文字以上含めてください。'

export function passwordPolicyError(password: string): string | null {
  const tooShort = password.length < PASSWORD_MIN_LENGTH
  const missingKind =
    !LOWER.test(password) || !UPPER.test(password) || !DIGIT.test(password) || !SYMBOL.test(password)
  if (!tooShort && !missingKind) return null
  if (tooShort && !missingKind) return 'パスワードは12文字以上にしてください。'
  return PASSWORD_POLICY_MESSAGE
}
