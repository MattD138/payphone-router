import type { LngLat } from '../geo'

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

export type WalkingRoute = {
  coordinates: [number, number][] // [lon, lat]
  distanceM: number
  durationS: number
  legs?: RouteLegSummary[]
}

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
  direct: WalkingRoute
  viaPhones: WalkingRoute
  stops: RouteStop[]
  selectedPhones: PayphoneFeature[]
  detourM: number
  maxPhones: number
  maxDetourM: number
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
  walkingRoute(waypoints: LngLat[]): Promise<WalkingRoute>
}
