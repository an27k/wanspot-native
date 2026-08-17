import { wanspotFetch } from '@/lib/wanspot-api'
import type { VlogRenderPayload } from '@/lib/vlog/build-payload'

export type VlogRenderStage = 'selecting' | 'connecting' | 'finishing'

export const VLOG_GENERATION_COPY: Record<VlogRenderStage, string> = {
  selecting: 'いい瞬間を選んでる…',
  connecting: 'つないでる…',
  finishing: '仕上げてる…',
}

export type VlogRenderResult = {
  videoUrl: string
  edlVersion: string
}

export type VlogRenderError = {
  code: 'network' | 'server' | 'not_ready'
  message: string
}

/**
 * Phase 4 — クラウドレンダー API。
 * 失敗時はクレジットを消費しない（サーバー側で保証）。404 は未デプロイ扱い。
 */
export async function requestVlogRender(
  payload: VlogRenderPayload
): Promise<{ ok: true; result: VlogRenderResult } | { ok: false; error: VlogRenderError }> {
  try {
    const res = await wanspotFetch('/api/vlog/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.status === 404) {
      return { ok: false, error: { code: 'not_ready', message: 'VLOG生成は準備中です' } }
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const json = (await res.json()) as { error?: string; message?: string }
        message = json.error ?? json.message ?? message
      } catch {
        /* ignore */
      }
      return { ok: false, error: { code: 'server', message } }
    }

    const result = (await res.json()) as VlogRenderResult
    if (!result?.videoUrl) {
      return { ok: false, error: { code: 'server', message: '動画URLの取得に失敗しました' } }
    }
    return { ok: true, result }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { code: 'network', message: msg || '通信に失敗しました' } }
  }
}

/** 開発用: 3段階の待機で生成演出を再現 */
export async function simulateVlogGenerationStages(
  onStage: (stage: VlogRenderStage) => void,
  delaysMs: [number, number, number] = [1800, 2200, 1600]
): Promise<void> {
  const stages: VlogRenderStage[] = ['selecting', 'connecting', 'finishing']
  for (let i = 0; i < stages.length; i++) {
    onStage(stages[i])
    await new Promise((r) => setTimeout(r, delaysMs[i]))
  }
}
