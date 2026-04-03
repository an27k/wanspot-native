import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, supabaseAdmin } from '../_lib'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/webhook
 * checkout.session.completed で参加登録（event_participants）。STRIPE_WEBHOOK_SECRET 必須。
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const buf = Buffer.from(await req.arrayBuffer())
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'account.updated') {
    const a = event.data.object as Stripe.Account
    const supabaseUserId = a.metadata?.supabase_user_id
    if (supabaseUserId) {
      const admin = supabaseAdmin()
      const completed = !!(a.details_submitted && a.charges_enabled)
      await admin
        .from('users')
        .update({ stripe_onboarding_completed: completed })
        .eq('id', supabaseUserId)
    }
    return NextResponse.json({ received: true })
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session
    if (s.payment_status !== 'paid') {
      return NextResponse.json({ received: true })
    }
    const eventId = s.metadata?.event_id
    const userId = s.metadata?.user_id
    if (eventId && userId) {
      const admin = supabaseAdmin()
      const { error } = await admin.from('event_participants').insert({
        event_id: eventId,
        user_id: userId,
      })
      if (error && !String(error.message).includes('duplicate')) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
