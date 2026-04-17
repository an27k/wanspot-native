import { supabase } from '@/lib/supabase'
import { getWanspotApiBase } from '@/lib/wanspot-api'
import type { AiPlanSseEvent, AiPlanTravelMode, AiPlanMood } from '@/components/ai-plan/types'
import { fetch as expoFetch } from 'expo/fetch'

export type AiPlanRequestBody = {
  mood: AiPlanMood
  prefecture: string
  municipality: string
  travel_mode: AiPlanTravelMode
  // extra fields are allowed (server Zod is non-strict)
  duration?: 'half_day' | 'full_day'
  dog_size?: 'XS' | 'S' | 'M' | 'L' | 'XL'
}

export async function streamAiPlan(
  body: AiPlanRequestBody,
  opts: {
    signal?: AbortSignal
    onEvent: (ev: AiPlanSseEvent) => void
  }
): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('認証エラー')

  const TD = (globalThis as any).TextDecoder as (new (label?: string) => { decode: (v: Uint8Array, o?: { stream?: boolean }) => string }) | undefined
  if (!TD) {
    throw new Error('この端末の実行環境では TextDecoder が利用できません（Expo SDK 55 の想定環境で再実行してください）')
  }

  const base = getWanspotApiBase()
  const res = await expoFetch(`${base}/api/ai-plans/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (!res.body) throw new Error('ストリーム取得失敗')

  const reader = res.body.getReader()
  const decoder = new TD('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data: '))
      if (!line) continue
      const json = line.slice(6).trim()
      try {
        const ev = JSON.parse(json) as AiPlanSseEvent
        opts.onEvent(ev)
      } catch {
        // ignore parse errors
      }
    }
  }
}
