-- 店内OK / テラスOK フィルタ用: status と pet_indoor_allowed / pet_terrace_only の整合
-- 本番適用済み（reconcile_pet_indoor_terrace_flags）。リポジトリ履歴用のミラー。

UPDATE public.spots
SET
  pet_indoor_allowed = false,
  pet_terrace_only = true
WHERE pet_friendly_status = 'outdoor_only'
  AND (
    pet_indoor_allowed IS DISTINCT FROM false
    OR pet_terrace_only IS DISTINCT FROM true
  );

UPDATE public.spots
SET
  pet_indoor_allowed = false,
  pet_terrace_only = false
WHERE pet_friendly_status = 'not_allowed'
  AND (
    pet_indoor_allowed IS DISTINCT FROM false
    OR pet_terrace_only IS DISTINCT FROM false
  );

UPDATE public.spots
SET
  pet_indoor_allowed = true,
  pet_terrace_only = COALESCE(pet_terrace_only, false)
WHERE pet_friendly_status IN ('allowed', 'leashed_only')
  AND pet_indoor_allowed IS NULL
  AND pet_friendly_notes IS NOT NULL
  AND pet_friendly_notes ~ '(店内(への)?(ペット|ワンちゃん)?(同伴|入店)?可|店内利用可能|店内OK|店内ペット可|全席ワンちゃんOK|店内・テラス席ともに|ドッグカフェのため店内)'
  AND pet_friendly_notes !~ '(自分のペット同伴については|同伴の可否については(口コミに)?明記なし|ふれあいカフェ)';

UPDATE public.spots
SET
  pet_indoor_allowed = false,
  pet_terrace_only = true,
  pet_friendly_status = CASE
    WHEN pet_friendly_status IN ('unknown', 'allowed', 'leashed_only') THEN 'outdoor_only'
    ELSE pet_friendly_status
  END
WHERE pet_terrace_only IS DISTINCT FROM true
  AND pet_friendly_status IS DISTINCT FROM 'not_allowed'
  AND pet_friendly_notes IS NOT NULL
  AND pet_friendly_notes ~ '(テラス席のみ|テラスのみ(同伴)?可|外席のみ|屋外(席|エリア)?のみ|店内(は)?不可.{0,12}(テラス|外席|屋外))'
  AND pet_friendly_notes !~ '(店内.{0,8}(同伴|入店)?可|店内・テラス)';

UPDATE public.spots
SET pet_terrace_only = false
WHERE pet_indoor_allowed IS TRUE
  AND pet_terrace_only IS NULL;

CREATE INDEX IF NOT EXISTS spots_pet_indoor_ok_idx
  ON public.spots (lat, lng)
  WHERE pet_indoor_allowed IS TRUE AND COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS spots_pet_terrace_ok_idx
  ON public.spots (lat, lng)
  WHERE (
    pet_terrace_only IS TRUE
    OR pet_friendly_status = 'outdoor_only'
  )
  AND COALESCE(is_deleted, false) = false;
