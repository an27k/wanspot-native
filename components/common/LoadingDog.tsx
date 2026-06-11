import { BrandLoader } from '@/components/common/BrandLoader'

/** @deprecated BrandLoader を直接使用してください */
export function LoadingDogSvg({ size = 96 }: { size?: number }) {
  return <BrandLoader size={size} />
}
