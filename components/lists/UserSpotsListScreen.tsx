import { SpotListCard } from '@/components/SpotListCard'
import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import type { PlaceCardEnrichment } from '@/lib/user-spot-list-utils'

/** いいね／行った一覧などで `SpotListCard` を縦に並べる共通ブロック（SVG ハートは SpotListCard 内） */
export function UserSpotsListScreen({
  spots,
  enrichment,
  userLocation,
  heartMode,
  onOpenSpot,
  onUnlike,
  unlikeLoadingId,
}: {
  spots: UserSpotRow[]
  enrichment: Record<string, PlaceCardEnrichment | undefined>
  userLocation: { lat: number; lng: number } | null
  heartMode: 'toggle' | 'likedOnly'
  onOpenSpot: (spotId: string) => void
  onUnlike?: (spotId: string) => void
  unlikeLoadingId?: string | null
}) {
  return (
    <>
      {spots.map((spot) => (
        <SpotListCard
          key={spot.id}
          row={spot}
          enrichment={enrichment[spot.place_id]}
          userLocation={userLocation}
          heartMode={heartMode}
          onOpen={() => onOpenSpot(spot.id)}
          onUnlike={onUnlike ? () => onUnlike(spot.id) : undefined}
          unlikeLoading={unlikeLoadingId === spot.id}
        />
      ))}
    </>
  )
}
