import { Image } from 'expo-image'

const FACE = require('@/assets/images/wanspot_dog_face.png')

/** 犬写真プレースホルダ（顔のみ） */
export function DogPawPlaceholder({ size = 40 }: { size?: number; fill?: string }) {
  return (
    <Image
      source={FACE}
      style={{ width: size, height: size * 0.82, opacity: 0.9 }}
      contentFit="contain"
    />
  )
}
