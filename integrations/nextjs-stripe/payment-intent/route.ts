import { NextRequest, NextResponse } from 'next/server'
import {
  applicationFeeAmountYen,
  getAuthedUserId,
  getStripe,
  publicSiteOrigin,
  supabaseAdmin,
} from '../_lib'

type Body = { eventId?: string }

/**
 * POST /api/stripe/payment-intent
 * 有料イベント参加用: Checkout Session を作成し、payment_intent に application_fee_amount と transfer_data.destination を付与。
 * クライアントは返却された url を開く（既存の Linking.openURL フローと互換）。
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthedUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Body = {}
    try {
      body = (await req.json()) as Body
    } catch {
      body = {}
    }
    const eventId = typeof body.eventId === 'string' ? body.eventId : ''
    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: ev, error: evErr } = await admin
      .from('events')
      .select('id, title, price, is_paid, creator_id, capacity, current_count')
      .eq('id', eventId)
      .maybeSingle()

    if (evErr || !ev) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const price = Number(ev.price ?? 0)
    const paid =
      ev.is_paid === true || (ev.is_paid !== false && price > 0)
    if (!paid || price < 1) {
      return NextResponse.json({ error: 'Event is not paid' }, { status: 400 })
    }

    const cap = ev.capacity != null ? Number(ev.capacity) : null
    const cur = ev.current_count != null ? Number(ev.current_count) : 0
    if (cap != null && Number.isFinite(cap) && cap > 0 && cur >= cap) {
      return NextResponse.json({ error: 'Event is full' }, { status: 400 })
    }

    const creatorId = ev.creator_id as string
    const { data: host, error: hostErr } = await admin
      .from('users')
      .select('stripe_account_id, stripe_onboarding_completed')
      .eq('id', creatorId)
      .maybeSingle()

    if (
      hostErr ||
      !host?.stripe_account_id ||
      !host?.stripe_onboarding_completed
    ) {
      return NextResponse.json({ error: 'Host is not ready for payments' }, { status: 400 })
    }

    const applicationFee = applicationFeeAmountYen(price)

    const { data: existing } = await admin
      .from('event_participants')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already joined' }, { status: 400 })
    }

    const stripe = getStripe()
    const origin = publicSiteOrigin()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: `${eventId}:${userId}`,
      metadata: { event_id: eventId, user_id: userId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: price,
            product_data: {
              name: `参加費: ${String(ev.title ?? 'イベント')}`,
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: host.stripe_account_id as string },
        metadata: { event_id: eventId, user_id: userId },
      },
      success_url: `${origin}/events/${encodeURIComponent(eventId)}?payment=success`,
      cancel_url: `${origin}/events/${encodeURIComponent(eventId)}?payment=cancel`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'No checkout URL' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Stripe error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
