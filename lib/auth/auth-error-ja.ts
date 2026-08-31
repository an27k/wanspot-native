import { PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy'

const INFRA =
  /timeout|522|503|504|502|fetch failed|failed to fetch|ECONNRESET|ETIMEDOUT|network|connection|Connection terminated|auth_timeout/i

/**
 * Supabase Auth が返す英語メッセージを、画面に出してよい日本語にする。
 * パスワード強度の記号一覧は出さない（文字化けに見える）。
 */
export function toJapaneseAuthError(raw: string): string {
  if (INFRA.test(raw)) {
    return '認証サービスに接続できません。しばらく待ってから再度お試しください。'
  }
  if (/Password should be at least|Password should contain at least one character of each|weak_password|Password is known to be weak/i.test(raw)) {
    return PASSWORD_POLICY_MESSAGE
  }
  if (/Invalid login credentials/i.test(raw)) {
    return 'メールアドレスまたはパスワードが正しくありません。'
  }
  if (/User already registered|already been registered|already exists/i.test(raw)) {
    return 'このメールアドレスはすでに登録されています。ログインしてください。'
  }
  if (/Email not confirmed/i.test(raw)) {
    return 'メールアドレスの確認が完了していません。'
  }
  if (/Unable to validate email address|invalid format|invalid email/i.test(raw)) {
    return 'メールアドレスの形式が正しくありません。'
  }
  if (/Signup requires a valid password|Password should/i.test(raw)) {
    return PASSWORD_POLICY_MESSAGE
  }
  if (/For security purposes, you can only request this after/i.test(raw)) {
    return '短時間に何度も試されたため、しばらく待ってから再度お試しください。'
  }
  if (/rate limit/i.test(raw)) {
    return 'アクセスが集中しています。しばらく待ってから再度お試しください。'
  }
  if (/[ぁ-んァ-ン一-龯]/.test(raw)) {
    return raw
  }
  return 'うまくいきませんでした。入力内容をご確認のうえ、もう一度お試しください。'
}
