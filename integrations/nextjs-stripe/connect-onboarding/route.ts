import { NextRequest, NextResponse } from 'next/server'
import {
  connectRefreshUrl,
  connectReturnUrl,
  getAuthedUserId,
  getStripe,
  supabaseAdmin,
} from '../_lib'

/**
 * POST /api/stripe/connect-onboarding
 * Express Connect の Account Link URL を返す。未作成なら Account を作成して users.stripe_account_id を保存。
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthedUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripe = getStripe()
    const admin = supabaseAdmin()

    const { data: row, error: selErr } = await admin
      .from('users')
      .select('stripe_account_id')
      .eq('id', userId)
      .maybeSingle()

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 })
    }

    let accountId = row?.stripe_account_id as string | null | undefined

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'JP',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { supabase_user_id: userId },
      })
      accountId = account.id
      const { error: upErr } = await admin
        .from('users')
        .update({ stripe_account_id: accountId, stripe_onboarding_completed: false })
        .eq('id', userId)
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: connectRefreshUrl(),
      return_url: connectReturnUrl(),
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: link.url })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Stripe error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
