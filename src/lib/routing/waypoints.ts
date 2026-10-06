import {
  CORRIDOR_BUFFER_M,
  CORRIDOR_CANDIDATE_LIMIT,
  DEFAULT_MAX_DETOUR_M,
  UNCAPPED_MAX_PHONES,
} from '../sydney'
import {
  distanceToPolylineM,
  haversineM,
  progressAlongPolyline,
  type LngLat,
} from '../geo'
import type {
  DirectionsProvider,
  PayphoneFeature,
  PlannedTrip,
  RouteStop,
  WalkingRoute,
} from './types'

export type PlanOptions = {
  maxPhones?: number
  maxDetourM?: number
  corridorBufferM?: number
}

/**
 * Greedy corridor insertion: up to N phones under max detour meters.
 * Pass Infinity / UNCAPPED_MAX_PHONES for no N cap (detour + corridor beam only).
 * 1) Direct A→B route
 * 2) Candidates within corridor buffer of the polyline
 * 3) Score by proximity to route; try inserts in along-route order
 * 4) Keep set if total detour ≤ budget; drop worst impact if over
 */
export async function planTripViaPayphones(
  directions: DirectionsProvider,
  origin: LngLat & { label: string },
  destination: LngLat & { label: string },
  phones: PayphoneFeature[],
  opts: PlanOptions = {},
): Promise<PlannedTrip> {
  const maxPhones = opts.maxPhones ?? UNCAPPED_MAX_PHONES
  const maxDetourM = opts.maxDetourM ?? DEFAULT_MAX_DETOUR_M
  const corridorBufferM = opts.corridorBufferM ?? CORRIDOR_BUFFER_M
  const uncapped = !Number.isFinite(maxPhones)

  const direct = await directions.walkingRoute([origin, destination])

  const candidates = phones
    .map((p) => ({
      phone: p,
      dist: distanceToPolylineM(
        { lon: p.lon, lat: p.lat },
        direct.coordinates,
      ),
      progress: progressAlongPolyline(
        { lon: p.lon, lat: p.lat },
        direct.coordinates,
      ),
    }))
    .filter((c) => c.dist <= corridorBufferM)
    .filter((c) => {
      // Skip phones essentially at origin/destination
      const nearOrigin =
        haversineM(origin, { lon: c.phone.lon, lat: c.phone.lat }) < 40
      const nearDest =
        haversineM(destination, { lon: c.phone.lon, lat: c.phone.lat }) < 40
      return !nearOrigin && !nearDest
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, CORRIDOR_CANDIDATE_LIMIT) // beam limit for phone CPU

  // Prefer phones close to the corridor; take top by closeness then order by progress.
  // Uncapped: use the full corridor beam (detour still gates inserts).
  const shortlistCap = uncapped
    ? candidates.length
    : Math.min(candidates.length, Math.max(maxPhones * 6, 12))
  const shortlist = candidates
    .slice(0, shortlistCap)
    .sort((a, b) => a.progress - b.progress)

  let selected: PayphoneFeature[] = []
  let viaPhones: WalkingRoute = direct

  // Greedy grow: try adding next closest unused phone (by corridor dist),
  // keep if under detour after re-route.
  const pool = [...shortlist].sort((a, b) => a.dist - b.dist)
  for (const cand of pool) {
    if (!uncapped && selected.length >= maxPhones) break
    if (selected.some((s) => s.id === cand.phone.id)) continue

    const trial = [...selected, cand.phone].sort((a, b) => {
      const pa = progressAlongPolyline(
        { lon: a.lon, lat: a.lat },
        direct.coordinates,
      )
      const pb = progressAlongPolyline(
        { lon: b.lon, lat: b.lat },
        direct.coordinates,
      )
      return pa - pb
    })

    try {
      const route = await directions.walkingRoute([
        origin,
        ...trial.map((p) => ({ lon: p.lon, lat: p.lat })),
        destination,
      ])
      const detour = route.distanceM - direct.distanceM
      if (detour <= maxDetourM) {
        selected = trial
        viaPhones = route
      }
    } catch {
      // skip phone that breaks routing
    }
  }

  // If we somehow exceeded (shouldn't), drop from end until OK
  while (selected.length > 0 && viaPhones.distanceM - direct.distanceM > maxDetourM) {
    selected = selected.slice(0, -1)
    viaPhones = await directions.walkingRoute([
      origin,
      ...selected.map((p) => ({ lon: p.lon, lat: p.lat })),
      destination,
    ])
  }

  const stops: RouteStop[] = [
    { kind: 'origin', label: origin.label, lon: origin.lon, lat: origin.lat },
    ...selected.map((p) => ({
      kind: 'payphone' as const,
      label: p.name,
      lon: p.lon,
      lat: p.lat,
      phoneId: p.id,
    })),
    {
      kind: 'destination',
      label: destination.label,
      lon: destination.lon,
      lat: destination.lat,
    },
  ]

  return {
    origin,
    destination,
    direct,
    viaPhones,
    stops,
    selectedPhones: selected,
    detourM: Math.max(0, viaPhones.distanceM - direct.distanceM),
    maxPhones,
    maxDetourM,
  }
}

/** Apple Maps URL with waypoints where feasible (walking). */
export function appleMapsUrl(stops: RouteStop[]): string {
  // maps.apple.com: saddr, daddr; intermediate via as +to: in daddr chain
  // Safari-friendly pattern: daddr=lat,lon+to:lat,lon
  if (stops.length < 2) return 'https://maps.apple.com/'
  const origin = stops[0]
  const rest = stops.slice(1)
  const saddr = `${origin.lat},${origin.lon}`
  // Keep +to: unencoded so Apple Maps accepts waypoints.
  return `https://maps.apple.com/?saddr=${encodeURIComponent(saddr)}&daddr=${rest
    .map((s) => encodeURIComponent(`${s.lat},${s.lon}`))
    .join('+to:')}&dirflg=w`
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

export function formatDuration(s: number): string {
  const mins = Math.round(s / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
