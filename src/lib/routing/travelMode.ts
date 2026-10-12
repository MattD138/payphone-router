/** Travel mode for OSRM routing + Maps deep links. Walking is the app default. */
export type TravelMode = 'walking' | 'driving'

export const DEFAULT_TRAVEL_MODE: TravelMode = 'walking'

const STORAGE_KEY = 'payphone-router:travelMode'

export function isTravelMode(value: unknown): value is TravelMode {
  return value === 'walking' || value === 'driving'
}

export function loadTravelMode(): TravelMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (isTravelMode(raw)) return raw
  } catch {
    // private mode / unavailable
  }
  return DEFAULT_TRAVEL_MODE
}

export function saveTravelMode(mode: TravelMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore quota / private mode
  }
}

/** OSRM profile query value sent to `/api/route` (defaults to foot server-side). */
export function osrmProfileForMode(mode: TravelMode): 'foot' | 'driving' {
  return mode === 'driving' ? 'driving' : 'foot'
}

/** Apple Maps `dirflg`: w = walk, d = drive. */
export function appleDirflg(mode: TravelMode): 'w' | 'd' {
  return mode === 'driving' ? 'd' : 'w'
}

/** Google Maps URLs `travelmode`. */
export function googleTravelMode(mode: TravelMode): 'walking' | 'driving' {
  return mode === 'driving' ? 'driving' : 'walking'
}
