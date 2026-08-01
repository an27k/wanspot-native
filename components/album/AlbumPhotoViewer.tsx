import { Modal, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { DogPhoto } from '@/lib/dog-photos'

type Props = {
  photo: DogPhoto | null
  onClose: () => void
}

/** アルバムの全画面写真表示（マイページ・アルバムタブ共通） */
export function AlbumPhotoViewer({ photo, onClose }: Props) {
  return (
    <Modal visible={photo != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.root} onPress={onClose}>
        {photo ? (
          <Image source={{ uri: photo.image_url }} style={styles.img} contentFit="contain" />
        ) : null}
        <Pressable style={styles.close} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  img: { width: '100%', height: '80%' },
  close: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
