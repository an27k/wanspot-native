import * as ImageManipulator from 'expo-image-manipulator'

export type CompressedImage = {
  uri: string
  width: number
  height: number
  size: number
}

/** 長辺 600px・JPEG 80%（アップロード前の安全化） */
export async function compressImageToJpeg(uri: string, maxWidth = 600): Promise<CompressedImage | null> {
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )
    const response = await fetch(manipulated.uri)
    const blob = await response.blob()
    return {
      uri: manipulated.uri,
      width: manipulated.width,
      height: manipulated.height,
      size: blob.size,
    }
  } catch (e) {
    console.warn('[compressImageToJpeg]', e)
    return null
  }
}
