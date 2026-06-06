import * as ImageManipulator from 'expo-image-manipulator'

/** iOS カメラの HEIC 等を Skia が読める JPEG に正規化 */
export async function normalizeCameraPhotoUri(sourceUri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(sourceUri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  })
  return out.uri
}
