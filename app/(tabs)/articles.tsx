import { ArticlesTabScreen } from '@/components/articles/ArticlesTabScreen'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'

export default function ArticlesTab() {
  return (
    <ScreenErrorBoundary label="articles">
      <ArticlesTabScreen />
    </ScreenErrorBoundary>
  )
}
