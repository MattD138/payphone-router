import type { LngLat } from '../geo'
import type { TravelMode } from './travelMode'

export type PlaceResult = {
  id: string
  label: string
  lon: number
  lat: number
}

export type RouteLegSummary = {
  distanceM: number
  durationS: number
}

/** Geometry + distance for a planned path (walk or drive). */
export type RouteResult = {
  coordinates: [number, number][] // [lon, lat]
  distanceM: number
  durationS: number
  legs?: RouteLegSummary[]
}

/** @deprecated Use RouteResult — kept for existing imports. */
export type WalkingRoute = RouteResult

export type PayphoneFeature = {
  id: number
  lon: number
  lat: number
  name: string
  holderId: number | null
  status: string
}

export type RouteStop =
  | { kind: 'origin' | 'destination'; label: string; lon: number; lat: number }
  | {
      kind: 'payphone'
      label: string
      lon: number
      lat: number
      phoneId: number
    }

export type PlannedTrip = {
  origin: LngLat & { label: string }
  destination: LngLat & { label: string }
  direct: RouteResult
  viaPhones: RouteResult
  stops: RouteStop[]
  selectedPhones: PayphoneFeature[]
  detourM: number
  maxPhones: number
  maxDetourM: number
  /** Mode used to compute this trip (Maps export must match). */
  travelMode: TravelMode
}

/** Swap-friendly provider interfaces (Photon/OSRM now; Mapbox later). */
export interface GeocodingProvider {
  search(
    query: string,
    opts?: { limit?: number; signal?: AbortSignal },
  ): Promise<PlaceResult[]>
  reverse?(lon: number, lat: number): Promise<PlaceResult | null>
}

export interface DirectionsProvider {
  route(waypoints: LngLat[], mode?: TravelMode): Promise<RouteResult>
  /** @deprecated Prefer `route(waypoints, 'walking')`. */
  walkingRoute?(waypoints: LngLat[]): Promise<RouteResult>
}
