import { useMemo, useState, type ReactNode } from 'react'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { colors } from '@/constants/colors'
import { getWanspotApiBase } from '@/lib/wanspot-api'
import { useAuth } from '@/context/AuthContext'

type AppHeaderProps = {
  variant?: 'default' | 'back'
  title?: string
  onBack?: () => void
  rightSlot?: ReactNode
}

export function AppHeader({ variant = 'default', title, onBack, rightSlot }: AppHeaderProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const { signOut } = useAuth()
  const base = useMemo(() => getWanspotApiBase(), [])
  const paddingTop = insets.top + 12

  const openWeb = (path: string) => {
    if (!base) return
    setMenuOpen(false)
    Linking.openURL(`${base}${path}`)
  }

  return (
    <>
      <View style={[styles.bar, { paddingTop, borderBottomColor: colors.border }]}>
        {variant === 'back' ? (
          <View style={styles.row}>
            <Pressable onPress={onBack} hitSlop={12} style={styles.side}>
              <Ionicons name="chevron-back-outline" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.titleMid} numberOfLines={1}>
              {title ?? ''}
            </Text>
            <View style={[styles.side, styles.sideRight]}>{rightSlot}</View>
          </View>
        ) : (
          <View style={styles.row}>
            <View style={styles.brand}>
              <Image
                source={require('@/assets/images/wanspot_icon.png')}
                style={styles.brandIcon}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <Text style={styles.brandText}>wanspot</Text>
            </View>
            <View style={styles.sideRight}>
              {rightSlot}
              <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
                <Ionicons name="menu-outline" size={26} color={colors.text} />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
          <View style={[styles.drawer, { paddingTop: insets.top + 12, paddingBottom: Math.max(24, insets.bottom + 16) }]}>
            <View style={styles.drawerHead}>
              <Text style={styles.drawerTitle}>メニュー</Text>
              <Pressable onPress={() => setMenuOpen(false)}>
                <Ionicons name="close-outline" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Pressable style={styles.menuRow} onPress={() => openWeb('/contact')}>
                <Text style={styles.menuText}>お問い合わせ</Text>
              </Pressable>
              <Pressable style={styles.menuRow} onPress={() => openWeb('/privacy')}>
                <Text style={styles.menuText}>プライバシーポリシー</Text>
              </Pressable>
              <Pressable style={styles.menuRow} onPress={() => openWeb('/terms')}>
                <Text style={styles.menuText}>利用規約</Text>
              </Pressable>
            </ScrollView>
            <Pressable
              style={styles.logoutBtn}
              onPress={async () => {
                setMenuOpen(false)
                await signOut()
                router.replace('/(auth)/login')
              }}
            >
              <Text style={styles.logoutText}>ログアウト</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: { width: 28, height: 28 },
  brandText: { fontWeight: '800', fontSize: 16, color: colors.text },
  side: { width: 40, justifyContent: 'center' },
  sideRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleMid: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
    color: colors.text,
  },
  modalRoot: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  drawer: {
    width: 280,
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { flexGrow: 1, paddingBottom: 8 },
  drawerHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drawerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  menuRow: { paddingVertical: 14 },
  menuText: { fontSize: 15, fontWeight: '700', color: colors.text },
  logoutBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  logoutText: { fontWeight: '700', color: colors.textMuted },
})
