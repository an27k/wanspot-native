import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors } from '@/constants/colors'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { UtsurunLiveOverlay } from '@/components/camera/UtsurunLiveOverlay'
import type { PickedImage } from '@/lib/image-picker'
import { applyUtsurunFilter, preloadUtsurunFilterAssets } from '@/lib/photo-filter/apply-utsurun-filter'

type Step = 'camera' | 'print'

type Props = {
  visible: boolean
  onClose: () => void
  onConfirm: (image: PickedImage) => void | Promise<void>
}

const FLASH_MS = 220
const PRINT_FADE_MS = 420

export function UtsurunCameraModal({ visible, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets()
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [step, setStep] = useState<Step>('camera')
  const [preview, setPreview] = useState<PickedImage | null>(null)
  const [busy, setBusy] = useState(false)
  const flashOpacity = useRef(new Animated.Value(0)).current
  const printOpacity = useRef(new Animated.Value(0)).current

  const reset = useCallback(() => {
    setStep('camera')
    setPreview(null)
    setBusy(false)
    flashOpacity.setValue(0)
    printOpacity.setValue(0)
  }, [flashOpacity, printOpacity])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  useEffect(() => {
    if (visible) void preloadUtsurunFilterAssets()
  }, [visible])

  const runFlash = useCallback(() => {
    flashOpacity.setValue(0.95)
    return new Promise<void>((resolve) => {
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: FLASH_MS,
        useNativeDriver: true,
      }).start(() => resolve())
    })
  }, [flashOpacity])

  const revealPrint = useCallback(() => {
    printOpacity.setValue(0)
    Animated.timing(printOpacity, {
      toValue: 1,
      duration: PRINT_FADE_MS,
      useNativeDriver: true,
    }).start()
  }, [printOpacity])

  const capture = useCallback(async () => {
    if (busy || step !== 'camera') return
    setBusy(true)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      const raw = await cameraRef.current?.takePictureAsync({
        quality: 0.92,
        shutterSound: true,
        skipProcessing: false,
      })
      await runFlash()
      if (!raw?.uri) {
        setStep('camera')
        return
      }

      setStep('print')
      setPreview(null)
      printOpacity.setValue(0)

      const filtered = await applyUtsurunFilter(raw.uri)
      setPreview(filtered)
      revealPrint()
    } catch {
      setStep('camera')
      setPreview(null)
      flashOpacity.setValue(0)
    } finally {
      setBusy(false)
    }
  }, [busy, step, runFlash, revealPrint, printOpacity, flashOpacity])

  const retake = useCallback(() => {
    setPreview(null)
    printOpacity.setValue(0)
    flashOpacity.setValue(0)
    setStep('camera')
  }, [printOpacity, flashOpacity])

  const confirm = useCallback(async () => {
    if (!preview || busy) return
    setBusy(true)
    try {
      await onConfirm(preview)
      handleClose()
    } finally {
      setBusy(false)
    }
  }, [preview, busy, onConfirm, handleClose])

  if (!visible) return null

  if (!permission) {
    return (
      <Modal visible animationType="slide" onRequestClose={handleClose}>
        <View style={styles.permWait} />
      </Modal>
    )
  }

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={handleClose}>
        <View style={[styles.permRoot, { padding: 24 }]}>
          <Text style={styles.permTitle}>カメラの許可が必要です</Text>
          <Text style={styles.permBody}>今日の1枚を撮るためにカメラへのアクセスを許可してください。</Text>
          <Pressable style={styles.primaryBtn} onPress={() => void requestPermission()}>
            <Text style={styles.primaryBtnTxt}>許可する</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={handleClose}>
            <Text style={styles.ghostBtnTxt}>キャンセル</Text>
          </Pressable>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        <CameraView
          ref={cameraRef}
          style={[StyleSheet.absoluteFillObject, step !== 'camera' && styles.cameraHidden]}
          facing="back"
        />
        {step === 'camera' ? (
          <>
            <UtsurunLiveOverlay />
            <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashOpacity }]} />
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={handleClose} style={styles.iconBtn} hitSlop={12}>
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
            </View>
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
              <Pressable
                style={[styles.shutter, busy && styles.shutterDisabled]}
                onPress={() => void capture()}
                disabled={busy}
              >
                <View style={styles.shutterInner} />
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 'print' ? (
          <View style={styles.printRoot}>
            {preview ? (
              <Animated.View style={[styles.printImageWrap, { opacity: printOpacity }]}>
                <Image source={{ uri: preview.uri }} style={styles.printImage} contentFit="contain" />
              </Animated.View>
            ) : null}

            <View style={[styles.printTopBar, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={retake} style={styles.iconBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </Pressable>
              <Pressable onPress={handleClose} style={styles.iconBtn} hitSlop={12}>
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
            </View>

            {preview ? (
              <View style={[styles.printActions, { paddingBottom: insets.bottom + 20 }]}>
                <Pressable style={styles.secondaryBtn} onPress={retake} disabled={busy}>
                  <Text style={styles.secondaryBtnTxt}>やり直す</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
                  onPress={() => void confirm()}
                  disabled={busy}
                >
                  <Text style={styles.primaryBtnTxt}>この1枚</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  cameraHidden: { opacity: 0 },
  permWait: { flex: 1, backgroundColor: '#000' },
  permRoot: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  permTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  permBody: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 4,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  printRoot: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printImageWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 72,
  },
  printImage: {
    width: '100%',
    height: '100%',
  },
  printTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    alignItems: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.55 },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  printActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnTxt: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  secondaryBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  ghostBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  ghostBtnTxt: { fontSize: 14, fontWeight: '700', color: '#888' },
})
