import { CalendarTabScreen } from '@/components/calendar/CalendarTabScreen'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'

export default function CalendarTab() {
  return (
    <ScreenErrorBoundary label="calendar">
      <CalendarTabScreen />
    </ScreenErrorBoundary>
  )
}
