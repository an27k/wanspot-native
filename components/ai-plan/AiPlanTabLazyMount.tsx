import { lazy, Suspense } from 'react'
import { RunningDog } from '@/components/DogStates'

const AiPlanTabLazy = lazy(() =>
  import('@/components/ai-plan/AiPlanTab').then((m) => ({ default: m.AiPlanTab }))
)

type Props = {
  onEmbeddedChromeVisibility?: (visible: boolean) => void
}

/** AIプランタブ本体。選択時のみバンドル・マウントする */
export function AiPlanTabLazyMount(props: Props) {
  return (
    <Suspense
      fallback={
        <RunningDog label="AIプランを読み込み中..." />
      }
    >
      <AiPlanTabLazy {...props} />
    </Suspense>
  )
}
