import { Asset } from 'expo-asset'
import { Skia, FontStyle, FontWeight, type SkFont } from '@shopify/react-native-skia'

const DSEG7 = require('../../assets/fonts/DSEG7Classic-Bold.ttf')

let cachedTypeface: ReturnType<typeof Skia.Typeface.MakeFreeTypeFaceFromData> | null | undefined

async function resolveDsegTypeface() {
  if (cachedTypeface !== undefined) return cachedTypeface
  try {
    const asset = Asset.fromModule(DSEG7)
    await asset.downloadAsync()
    const uri = asset.localUri ?? asset.uri
    if (!uri) {
      cachedTypeface = null
      return null
    }
    const data = await Skia.Data.fromURI(uri)
    cachedTypeface = Skia.Typeface.MakeFreeTypeFaceFromData(data)
    return cachedTypeface
  } catch {
    cachedTypeface = null
    return null
  }
}

function systemBoldTypeface() {
  const fontMgr = Skia.FontMgr.System()
  const families = ['Menlo', 'Courier New', 'Courier']
  for (const name of families) {
    const face = fontMgr.matchFamilyStyle(name, FontStyle.Bold)
    if (face) return face
  }
  return fontMgr.matchFamilyStyle('Helvetica', FontStyle.Bold)
}

/** DSEG7 Classic（OFL）→ 失敗時は等幅 Bold */
export async function loadUtsurunFont(size: number): Promise<SkFont> {
  const dseg = await resolveDsegTypeface()
  const typeface = dseg ?? systemBoldTypeface()
  return Skia.Font(typeface, size)
}
