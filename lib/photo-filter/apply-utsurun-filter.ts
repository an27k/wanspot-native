import { Asset } from 'expo-asset'
import { File, Paths } from 'expo-file-system'
import {
  Skia,
  ImageFormat,
  FilterMode,
  MipmapMode,
  TileMode,
  BlendMode,
  type SkCanvas,
  type SkImage,
  type SkPaint,
} from '@shopify/react-native-skia'
import type { PickedImage } from '@/lib/image-picker'
import { formatUtsurunDate } from '@/lib/photo-filter/format-utsurun-date'
import { loadUtsurunFont } from '@/lib/photo-filter/load-utsurun-font'
import { UTSURUN_COLOR_MATRIX } from '@/lib/photo-filter/utsurun-matrix'

const GRAIN_MOD = require('../../assets/filter/grain.png')
const LIGHTLEAK_MOD = require('../../assets/filter/lightleak.png')
const VIGNETTE_MOD = require('../../assets/filter/vignette.png')

/** 加工時の長辺上限（メモリ保護。保存はこの寸法のまま） */
const MAX_LONG_EDGE = 4096
const JPEG_QUALITY = 88
const GRAIN_OPACITY = 0.2
const LIGHTLEAK_OPACITY = 0.4
const BLUR_SIGMA = 0.7
const DATE_COLOR = '#FF9628'

const overlayCache = new Map<number, SkImage>()

async function loadBundledSkiaImage(moduleId: number): Promise<SkImage> {
  const hit = overlayCache.get(moduleId)
  if (hit) return hit
  const asset = Asset.fromModule(moduleId)
  await asset.downloadAsync()
  const uri = asset.localUri ?? asset.uri
  const data = await Skia.Data.fromURI(uri)
  const image = Skia.Image.MakeImageFromEncoded(data)
  if (!image) throw new Error('オーバーレイ画像の読み込みに失敗しました')
  overlayCache.set(moduleId, image)
  return image
}

function fitLongEdge(w: number, h: number): { width: number; height: number; scale: number } {
  const long = Math.max(w, h)
  if (long <= MAX_LONG_EDGE) return { width: w, height: h, scale: 1 }
  const scale = MAX_LONG_EDGE / long
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
    scale,
  }
}

function drawFitOverlay(
  canvas: SkCanvas,
  overlay: SkImage,
  destW: number,
  destH: number,
  paint: SkPaint
) {
  const src = Skia.XYWHRect(0, 0, overlay.width(), overlay.height())
  const dst = Skia.XYWHRect(0, 0, destW, destH)
  canvas.drawImageRect(overlay, src, dst, paint)
}

/**
 * 写ルンです風フィルターをオリジナル解像度（長辺上限あり）で焼き込み、JPEG を返す。
 * UI スレッドをブロックしないよう先頭で yield する。
 */
export async function applyUtsurunFilter(sourceUri: string): Promise<PickedImage> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))

  const photoData = await Skia.Data.fromURI(sourceUri)
  const decoded = Skia.Image.MakeImageFromEncoded(photoData)
  if (!decoded) throw new Error('写真の読み込みに失敗しました')

  const { width, height, scale } = fitLongEdge(decoded.width(), decoded.height())
  let photo = decoded

  if (scale !== 1) {
    const resizeSurface = Skia.Surface.Make(width, height)
    if (!resizeSurface) throw new Error('リサイズ用サーフェスの作成に失敗しました')
    const rc = resizeSurface.getCanvas()
    const rp = Skia.Paint()
    rc.drawImageRect(
      decoded,
      Skia.XYWHRect(0, 0, decoded.width(), decoded.height()),
      Skia.XYWHRect(0, 0, width, height),
      rp
    )
    photo = resizeSurface.makeImageSnapshot()
  }

  const surface = Skia.Surface.Make(width, height)
  if (!surface) throw new Error('描画サーフェスの作成に失敗しました')
  const canvas = surface.getCanvas()
  const fullRect = Skia.XYWHRect(0, 0, width, height)

  // 1–3: 色グレード + 微ブラー
  const colorCF = Skia.ColorFilter.MakeMatrix(UTSURUN_COLOR_MATRIX)
  const colorIF = Skia.ImageFilter.MakeColorFilter(colorCF, null)
  const blurIF = Skia.ImageFilter.MakeBlur(BLUR_SIGMA, BLUR_SIGMA, TileMode.Clamp, colorIF)
  const basePaint = Skia.Paint()
  basePaint.setImageFilter(blurIF)
  canvas.drawImage(photo, 0, 0, basePaint)

  // 4: grain（タイル repeat・overlay）
  const grain = await loadBundledSkiaImage(GRAIN_MOD)
  const grainPaint = Skia.Paint()
  grainPaint.setShader(
    grain.makeShaderOptions(TileMode.Repeat, TileMode.Repeat, FilterMode.Nearest, MipmapMode.None)
  )
  grainPaint.setBlendMode(BlendMode.Overlay)
  grainPaint.setAlphaf(GRAIN_OPACITY)
  canvas.drawRect(fullRect, grainPaint)

  // 5: light leak（screen・全体 fit）
  const lightleak = await loadBundledSkiaImage(LIGHTLEAK_MOD)
  const leakPaint = Skia.Paint()
  leakPaint.setBlendMode(BlendMode.Screen)
  leakPaint.setAlphaf(LIGHTLEAK_OPACITY)
  drawFitOverlay(canvas, lightleak, width, height, leakPaint)

  // 6: vignette（multiply・全体 fit）
  const vignette = await loadBundledSkiaImage(VIGNETTE_MOD)
  const vigPaint = Skia.Paint()
  vigPaint.setBlendMode(BlendMode.Multiply)
  drawFitOverlay(canvas, vignette, width, height, vigPaint)

  // 7: 日付スタンプ（常時 ON・右下オレンジ）
  const fontSize = Math.max(18, Math.min(72, Math.round(Math.min(width, height) * 0.045)))
  const margin = Math.round(Math.min(width, height) * 0.04)
  const font = await loadUtsurunFont(fontSize)
  const dateText = formatUtsurunDate()
  const textBounds = font.measureText(dateText)
  const metrics = font.getMetrics()
  const x = width - margin - textBounds.width
  const y = height - margin - metrics.descent
  const textPaint = Skia.Paint()
  textPaint.setColor(Skia.Color(DATE_COLOR))
  textPaint.setAntiAlias(true)
  canvas.drawText(dateText, x, y, textPaint, font)

  const snapshot = surface.makeImageSnapshot()
  const bytes = snapshot.encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY)

  const file = new File(Paths.cache, `utsurun-${Date.now()}.jpg`)
  file.write(bytes)

  return {
    uri: file.uri,
    width,
    height,
    size: bytes.byteLength,
  }
}
