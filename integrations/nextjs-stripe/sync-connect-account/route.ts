import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUserId, getStripe, supabaseAdmin } from '../_lib'

/**
 * POST /api/stripe/sync-connect-account
 * オンボーディング完了状態を Stripe から取得して users.stripe_onboarding_completed を更新。
 * （account.updated Webhook と併用推奨）
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthedUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = supabaseAdmin()
    const { data: row, error } = await admin
      .from('users')
      .select('stripe_account_id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const accountId = row?.stripe_account_id as string | null | undefined
    if (!accountId) {
      return NextResponse.json({ ok: true, stripe_onboarding_completed: false })
    }

    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(accountId)
    const completed = !!(account.details_submitted && account.charges_enabled)

    const { error: upErr } = await admin
      .from('users')
      .update({ stripe_onboarding_completed: completed })
      .eq('id', userId)

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, stripe_onboarding_completed: completed })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Stripe error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
