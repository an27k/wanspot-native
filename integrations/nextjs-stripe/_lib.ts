/**
 * Next.js API 用ヘルパ（wanspot-native リポジトリから Web へコピーする想定）
 * 本番では既存の Stripe クライアント生成に差し替え可
 */
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import Stripe from 'stripe'

export function platformFeePercent(): number {
  const raw = process.env.PLATFORM_FEE_PERCENT ?? '0'
  const n = parseFloat(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export function applicationFeeAmountYen(priceYen: number): number {
  const p = platformFeePercent()
  return Math.round((priceYen * p) / 100)
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key)
}

export async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const jwt = auth.slice(7)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin env missing')
  return createClient(url, key)
}

export function connectReturnUrl(): string {
  return (
    process.env.STRIPE_CONNECT_RETURN_URL?.trim() ||
    'https://wanspot.app/events/create?connect=success'
  )
}

export function connectRefreshUrl(): string {
  return (
    process.env.STRIPE_CONNECT_REFRESH_URL?.trim() ||
    'https://wanspot.app/events/create?connect=refresh'
  )
}

export function publicSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://wanspot.app').replace(/\/$/, '')
}
