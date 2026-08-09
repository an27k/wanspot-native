import { supabase } from '@/lib/supabase'

/**
 * スポットの犬連れ情報を、知っている飼い主から教えてもらう。
 *
 * AIレビューが「ネットに情報が見つかりませんでした」になったスポットで出す枠の送信先。
 * ここに入るのは検索では埋まらない層（足洗い場・水飲み・サイズ制限など）である見込み。
 * 本文は service_role だけが読める箱に貯まり、件数が揃ったら構造化抽出に流す。
 */
export async function submitSpotInfoTip(
  spotId: string,
  body: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const text = body.trim()
  if (!text) return { ok: false, message: '内容を入力してください' }
  if (text.length > 1000) return { ok: false, message: '1000文字以内で入力してください' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }

  const { error } = await supabase.from('spot_info_tips').insert({
    spot_id: spotId,
    user_id: user.id,
    body: text,
    source: 'ai_review_empty',
  })
  if (error) {
    console.warn('[spot-info-tips]', error.code, error.message)
    return { ok: false, message: '送信できませんでした。時間をおいてお試しください' }
  }
  return { ok: true }
}
