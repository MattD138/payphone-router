import type { GeocodingProvider, PlaceResult } from './types'
import { SYDNEY_BBOX } from '../sydney'

/**
 * Nominatim via our server proxy (CORS + polite User-Agent).
 * Swap: implement MapboxGeocodingProvider with the same interface.
 */
export class NominatimGeocoder implements GeocodingProvider {
  private baseUrl: string

  constructor(baseUrl = '/api/geocode') {
    this.baseUrl = baseUrl
  }

  async search(query: string, opts?: { limit?: number }): Promise<PlaceResult[]> {
    const q = query.trim()
    if (q.length < 2) return []
    const params = new URLSearchParams({
      q,
      limit: String(opts?.limit ?? 5),
      viewbox: `${SYDNEY_BBOX.minLon},${SYDNEY_BBOX.maxLat},${SYDNEY_BBOX.maxLon},${SYDNEY_BBOX.minLat}`,
      bounded: '1',
    })
    const res = await fetch(`${this.baseUrl}?${params}`)
    if (!res.ok) throw new Error(`Geocode failed (${res.status})`)
    const data = (await res.json()) as Array<{
      place_id: number
      display_name: string
      lon: string
      lat: string
    }>
    return data.map((r) => ({
      id: String(r.place_id),
      label: r.display_name,
      lon: Number(r.lon),
      lat: Number(r.lat),
    }))
  }

  async reverse(lon: number, lat: number): Promise<PlaceResult | null> {
    const params = new URLSearchParams({
      lon: String(lon),
      lat: String(lat),
    })
    const res = await fetch(`${this.baseUrl}/reverse?${params}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      place_id?: number
      display_name?: string
      lon?: string
      lat?: string
    }
    if (!data.display_name || data.lon == null || data.lat == null) return null
    return {
      id: String(data.place_id ?? `${lon},${lat}`),
      label: data.display_name,
      lon: Number(data.lon),
      lat: Number(data.lat),
    }
  }
}
