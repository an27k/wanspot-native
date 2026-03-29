export const initAnalytics = () => {
  console.log('[analytics] init skipped')
}

export const track = (event: string, props?: Record<string, unknown>) => {
  console.log('[analytics] track:', event, props)
}
