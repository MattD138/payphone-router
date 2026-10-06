import type { LngLat } from '../geo'
import type { DirectionsProvider, WalkingRoute } from './types'

/**
 * Public OSRM foot profile via our server proxy.
 * Swap: MapboxDirectionsProvider implementing DirectionsProvider.
 */
export class OsrmDirections implements DirectionsProvider {
  private baseUrl: string

  constructor(baseUrl = '/api/route') {
    this.baseUrl = baseUrl
  }

  async walkingRoute(waypoints: LngLat[]): Promise<WalkingRoute> {
    if (waypoints.length < 2) {
      throw new Error('Need at least origin and destination')
    }
    const coords = waypoints.map((w) => `${w.lon},${w.lat}`).join(';')
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'false',
    })
    const res = await fetch(`${this.baseUrl}/${coords}?${params}`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Routing failed (${res.status}): ${text.slice(0, 120)}`)
    }
    const data = (await res.json()) as {
      code?: string
      routes?: Array<{
        distance: number
        duration: number
        geometry: { coordinates: [number, number][] }
        legs?: Array<{ distance: number; duration: number }>
      }>
      message?: string
    }
    if (!data.routes?.[0]) {
      throw new Error(data.message || data.code || 'No walking route found')
    }
    const r = data.routes[0]
    return {
      coordinates: r.geometry.coordinates,
      distanceM: r.distance,
      durationS: r.duration,
      legs: r.legs?.map((l) => ({
        distanceM: l.distance,
        durationS: l.duration,
      })),
    }
  }
}
