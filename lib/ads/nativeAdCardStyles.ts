import { StyleSheet } from 'react-native'

/**
 * ネイティブ広告カード共通（一覧・AIプラン用）
 * CTA グレー / 外側余白 16 / 16:9 メディア 等を統一する
 */
export const sharedNativeAdStyles = StyleSheet.create({
  adCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    overflow: 'hidden',
    marginVertical: 16,
    marginHorizontal: 16,
  },
  adLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  adLabel: {
    fontSize: 11,
    color: '#999999',
  },
  adInfo: {
    fontSize: 13,
    color: '#999999',
    paddingHorizontal: 4,
  },
  /** 幅は `NativeAdStandardCard` 側で onLayout により 16:9 かつ min 120pt を満たす高さを付与 */
  mediaView: {
    width: '100%',
    backgroundColor: '#F5F5F5',
  },
  mediaRow: {
    width: '100%',
    backgroundColor: '#F5F5F5',
  },
  adContent: {
    padding: 12,
  },
  headline: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 12,
  },
  headBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  headBodyStack: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  advertiser: {
    fontSize: 12,
    color: '#999999',
    flex: 1,
    marginRight: 8,
  },
  ctaButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  ctaText: {
    color: '#555555',
    fontSize: 14,
    fontWeight: '500',
  },
  starText: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 8,
  },
  placeholder: {
    height: 200,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderHint: {
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    textAlign: 'center',
  },
})
