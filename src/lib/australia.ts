/** Continental Australia + Tasmania (excludes external territories). */
export const AU_BBOX = {
  minLon: 112.9,
  maxLon: 153.65,
  minLat: -43.75,
  maxLat: -10.05,
} as const

/** Map default when GPS is unavailable — geographic centre of Australia. */
export const AU_CENTER: [number, number] = [133.7751, -25.2744]

export const AU_DEFAULT_ZOOM = 4.2
export const AU_USER_ZOOM = 13.5

/** Slider default when the user opts into an explicit N cap. */
export const DEFAULT_MAX_PHONES = 3
/**
 * Uncapped mode: no N limit — only detour budget + corridor beam bound selection.
 * Infinity so greedy insertion never stops on count alone.
 */
export const UNCAPPED_MAX_PHONES = Number.POSITIVE_INFINITY
export const DEFAULT_MAX_DETOUR_M = 800
export const CORRIDOR_BUFFER_M = 600
/** Corridor candidate beam — hard performance bound regardless of maxPhones. */
export const CORRIDOR_CANDIDATE_LIMIT = 40

export function isInAustralia(lon: number, lat: number): boolean {
  return (
    lon >= AU_BBOX.minLon &&
    lon <= AU_BBOX.maxLon &&
    lat >= AU_BBOX.minLat &&
    lat <= AU_BBOX.maxLat
  )
}

/** Nominatim viewbox order: minLon, maxLat, maxLon, minLat */
export function auViewboxNominatim(): string {
  return `${AU_BBOX.minLon},${AU_BBOX.maxLat},${AU_BBOX.maxLon},${AU_BBOX.minLat}`
}

/** Photon bbox order: minLon, minLat, maxLon, maxLat */
export function auBboxPhoton(): string {
  return `${AU_BBOX.minLon},${AU_BBOX.minLat},${AU_BBOX.maxLon},${AU_BBOX.maxLat}`
}
