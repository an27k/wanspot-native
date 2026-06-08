import * as ImageManipulator from 'expo-image-manipulator'

/** iOS カメラの HEIC 等を Skia が読める JPEG に正規化 */
export async function normalizeCameraPhotoUri(sourceUri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(
    sourceUri,
    [],
    {
      compress: 0.92,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  )
  if (!out.uri || out.width < 1 || out.height < 1) {
    throw new Error('写真の正規化に失敗しました')
  }
  return out.uri
}
