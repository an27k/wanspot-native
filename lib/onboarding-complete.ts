import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Router } from 'expo-router'
import { ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { defaultBioFromDog } from '@/lib/default-bio'
import {
  OB_DOG_KEY,
  OB_LOCATION_GRANTED,
  OB_LOCATION_KEY,
  POST_ONBOARDING_TUTORIAL_KEY,
} from '@/lib/onboarding-constants'
import { upsertUserWithWalkAreas } from '@/lib/persist-user-walk-area'
import { supabase } from '@/lib/supabase'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'

export type CompleteOnboardingResult = { ok: true } | { ok: false; message: string }

/** オンボーディング完了 — 散歩エリアタグは空でも可（位置許可済みユーザー） */
export async function completeOnboarding(params: {
  walkAreaTags: string[]
  router: Router
}): Promise<CompleteOnboardingResult> {
  const normalized = walkAreaTagsForUpsert(params.walkAreaTags)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const rawDog = await AsyncStorage.getItem(OB_DOG_KEY)
  if (!user || !rawDog) {
    return { ok: false, message: '入力データが見つかりません。最初からやり直してください。' }
  }

  const dog = JSON.parse(rawDog) as {
    name?: string
    year?: string
    month?: string
    day?: string
    breed?: string
    size?: 'XS' | 'S' | 'M' | 'L' | 'XL'
    vaccineCombo?: boolean | null
    vaccineRabies?: boolean | null
    vaccineComboDate?: string | null
    vaccineRabiesDate?: string | null
    photo_url?: string | null
  }

  const dogSize =
    dog.size === 'XS' || dog.size === 'S' || dog.size === 'M' || dog.size === 'L' || dog.size === 'XL'
      ? dog.size
      : null

  const dayPart = typeof dog.day === 'string' && dog.day.trim() !== '' ? dog.day.trim() : '1'
  const birthday = dog.year && dog.month ? ownerBirthdayToYmd(String(dog.year), String(dog.month), dayPart) : null

  const { error: userUpsertError } = await upsertUserWithWalkAreas(supabase, {
    id: user.id,
    name: user.email?.split('@')[0]?.trim() || 'ユーザー',
    parent_type: 'papa',
    birthday: null,
    bio: defaultBioFromDog({ name: dog.name, breed: dog.breed }),
    walkAreaTags: normalized,
  })
  if (userUpsertError) {
    return { ok: false, message: userUpsertError.message }
  }

  const dogExtra = { walk_area_tags: normalized, is_primary: true }
  const dogBase = {
    name: dog.name ?? '',
    birthday,
    breed: dog.breed ?? null,
    gender: null,
    size: dogSize,
    photo_url: dog.photo_url ?? null,
    rabies_vaccinated: dog.vaccineRabies === true,
    vaccine_vaccinated: dog.vaccineCombo === true,
    rabies_vaccinated_at: dog.vaccineRabiesDate || null,
    vaccine_vaccinated_at: dog.vaccineComboDate || null,
  }
  const isNewColumnMissing = (err: { message?: string } | null) =>
    !!err?.message && (err.message.includes('walk_area_tags') || err.message.includes('is_primary'))

  const { data: existingDog, error: dogSelErr } = await supabase
    .from('dogs')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (dogSelErr) {
    return { ok: false, message: dogSelErr.message }
  }

  const runDogWrite = async (payload: Record<string, unknown>) =>
    existingDog?.id
      ? supabase.from('dogs').update(payload).eq('id', existingDog.id)
      : supabase.from('dogs').insert({ user_id: user.id, ...payload })

  let dogWrite = await runDogWrite({ ...dogBase, ...dogExtra })
  if (dogWrite.error && isNewColumnMissing(dogWrite.error)) {
    dogWrite = await runDogWrite(dogBase)
  }
  if (dogWrite.error) {
    return { ok: false, message: dogWrite.error.message }
  }

  await Promise.all([
    AsyncStorage.removeItem(OB_DOG_KEY),
    AsyncStorage.removeItem('ob_size'),
    AsyncStorage.removeItem('ob_area'),
    AsyncStorage.removeItem(OB_LOCATION_KEY),
    AsyncStorage.removeItem(OB_LOCATION_GRANTED),
  ])
  await AsyncStorage.setItem(POST_ONBOARDING_TUTORIAL_KEY, '1')

  params.router.replace('/(tabs)/search')
  return { ok: true }
}
