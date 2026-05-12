import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { Alert, Linking } from 'react-native'

export interface PickedImage {
  uri: string
  width: number
  height: number
  size: number // bytes
}

/**
 * 画像をリサイズ・圧縮する
 * 長辺を 600px に揃え、JPEG 80% 品質で出力
 */
async function compressImage(uri: string): Promise<PickedImage> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 600 } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  )

  const response = await fetch(manipulated.uri)
  const blob = await response.blob()

  return {
    uri: manipulated.uri,
    width: manipulated.width,
    height: manipulated.height,
    size: blob.size,
  }
}

/**
 * 写真ライブラリから画像を選択
 */
export async function pickFromLibrary(): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

  if (status !== 'granted') {
    Alert.alert(
      '権限が必要です',
      '設定アプリから写真ライブラリへのアクセスを許可してください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => Linking.openSettings() },
      ]
    )
    return null
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  })

  if (result.canceled) return null

  const asset = result.assets[0]
  return await compressImage(asset.uri)
}

/**
 * カメラで写真を撮影
 */
export async function takePhoto(): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()

  if (status !== 'granted') {
    Alert.alert(
      '権限が必要です',
      '設定アプリからカメラへのアクセスを許可してください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => Linking.openSettings() },
      ]
    )
    return null
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  })

  if (result.canceled) return null

  const asset = result.assets[0]
  return await compressImage(asset.uri)
}

/**
 * ユーザーに「ライブラリ / カメラ / キャンセル」のアクションシートを表示
 */
export function showImagePickerOptions(onPick: (image: PickedImage) => void) {
  Alert.alert(
    '写真を選択',
    undefined,
    [
      {
        text: 'カメラで撮影',
        onPress: async () => {
          const image = await takePhoto()
          if (image) onPick(image)
        },
      },
      {
        text: 'ライブラリから選択',
        onPress: async () => {
          const image = await pickFromLibrary()
          if (image) onPick(image)
        },
      },
      { text: 'キャンセル', style: 'cancel' },
    ]
  )
}

