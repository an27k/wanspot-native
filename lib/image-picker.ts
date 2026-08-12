import * as ImagePicker from 'expo-image-picker'
import { Alert, Linking } from 'react-native'
import { compressImageToJpeg } from '@/lib/images/compress-image'

export interface PickedImage {
  uri: string
  width: number
  height: number
  size: number // bytes
}

async function compressImage(uri: string): Promise<PickedImage> {
  const compressed = await compressImageToJpeg(uri, 600)
  if (!compressed) {
    throw new Error('compress failed')
  }
  return compressed
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
 * カメラで写真を撮影（プロフィール等・1:1クロップ + 600px 圧縮）
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
 * アルバム用：画像・動画をまとめて選択（最大 limit 件）
 */
export async function pickMemoryMediaMulti(limit = 10): Promise<{ uri: string; mimeType: string }[] | null> {
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
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: false,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
    videoMaxDuration: 120,
  })

  if (result.canceled || result.assets.length === 0) return null
  return result.assets.map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
  }))
}

export type PickedDailyLogMedia = { uri: string; mimeType: string }

/**
 * きょうのログ用：カメラで写真 or 短い動画（最大10秒）を1点撮影
 *
 * **REVIEW_ALBUM_TAB_ENABLED を true にする前に読むこと。**
 * 2026-08-12 に NSMicrophoneUsageDescription を Info.plist から外した。
 * 理由は、この関数の唯一の呼び出し元（DailyLogComposerModal）がアルバムのフラグで
 * 止まっていて動画撮影に到達できず、「宣言だけあって使わない権限」が審査の
 * 指摘対象になるため（同じ形で ATT が Guideline 2.1 で差し戻された）。
 *
 * mediaTypes に動画を含んだままフラグを立てると、録音権限の記述が無い状態で
 * カメラが起動し **iOS がアプリを強制終了させる**。アルバムを再開するときは
 * app.json の expo-image-picker から `microphonePermission: false` を外すこと。
 */
export async function captureDailyLogMedia(): Promise<PickedDailyLogMedia | null> {
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
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: false,
    quality: 1,
    videoMaxDuration: 10,
  })

  if (result.canceled || result.assets.length === 0) return null
  const asset = result.assets[0]
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
  }
}

/**
 * きょうのログ用：ライブラリから写真・動画を1点選択
 */
export async function pickDailyLogMedia(): Promise<PickedDailyLogMedia | null> {
  const items = await pickMemoryMediaMulti(1)
  return items?.[0] ?? null
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

