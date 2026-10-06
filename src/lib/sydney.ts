/** Greater Sydney bbox used for MVP filtering and map framing. */
export const SYDNEY_BBOX = {
  minLon: 150.5,
  maxLon: 151.4,
  minLat: -34.2,
  maxLat: -33.4,
} as const

export const SYDNEY_CENTER: [number, number] = [151.2093, -33.8688]

export const DEFAULT_MAX_PHONES = 3
export const DEFAULT_MAX_DETOUR_M = 800
export const CORRIDOR_BUFFER_M = 600

export function isInSydney(lon: number, lat: number): boolean {
  return (
    lon >= SYDNEY_BBOX.minLon &&
    lon <= SYDNEY_BBOX.maxLon &&
    lat >= SYDNEY_BBOX.minLat &&
    lat <= SYDNEY_BBOX.maxLat
  )
}
