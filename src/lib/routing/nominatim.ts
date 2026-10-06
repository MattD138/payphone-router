import type { GeocodingProvider, PlaceResult } from './types'
import { GeocodeError } from './geocode-error'
import { SYDNEY_BBOX } from '../sydney'

/**
 * Server-proxied geocoder (Photon by default; Nominatim optional upstream).
 * Client talks only to `/api/geocode` — swap Mapbox later via providers.ts.
 */
export class NominatimGeocoder implements GeocodingProvider {
  private baseUrl: string

  constructor(baseUrl = '/api/geocode') {
    this.baseUrl = baseUrl
  }

  async search(
    query: string,
    opts?: { limit?: number; signal?: AbortSignal },
  ): Promise<PlaceResult[]> {
    const q = query.trim()
    if (q.length < 2) return []
    const params = new URLSearchParams({
      q,
      limit: String(opts?.limit ?? 5),
      // Nominatim-order viewbox; server converts for Photon bbox
      viewbox: `${SYDNEY_BBOX.minLon},${SYDNEY_BBOX.maxLat},${SYDNEY_BBOX.maxLon},${SYDNEY_BBOX.minLat}`,
      bounded: '1',
    })
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}?${params}`, { signal: opts?.signal })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new GeocodeError('Network error during place search', {
        code: 'network',
        status: 0,
      })
    }

    let data: unknown
    try {
      data = await res.json()
    } catch {
      throw new GeocodeError(
        res.status === 429
          ? 'Search is rate-limited right now. Wait a moment and try again.'
          : `Geocode failed (${res.status})`,
        {
          code: res.status === 429 ? 'rate_limited' : 'upstream',
          status: res.status,
        },
      )
    }

    if (!res.ok) {
      const body = data as { error?: string; code?: string }
      const code =
        body.code === 'rate_limited' || res.status === 429
          ? 'rate_limited'
          : body.code === 'bad_request'
            ? 'bad_request'
            : 'upstream'
      throw new GeocodeError(
        body.error ||
          (code === 'rate_limited'
            ? 'Search is rate-limited right now. Wait a moment and try again.'
            : `Geocode failed (${res.status})`),
        { code, status: res.status },
      )
    }

    // New shape: { provider, results }
    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as { results?: unknown }).results)
    ) {
      return (data as { results: PlaceResult[] }).results
    }

    // Legacy Nominatim array (if an old deploy is briefly mixed)
    if (Array.isArray(data)) {
      return (data as Array<{
        place_id: number
        display_name: string
        lon: string
        lat: string
      }>).map((r) => ({
        id: String(r.place_id),
        label: r.display_name,
        lon: Number(r.lon),
        lat: Number(r.lat),
      }))
    }

    return []
  }

  async reverse(lon: number, lat: number): Promise<PlaceResult | null> {
    const params = new URLSearchParams({
      lon: String(lon),
      lat: String(lat),
    })
    const res = await fetch(`${this.baseUrl}/reverse?${params}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      result?: PlaceResult | null
      // legacy Nominatim reverse
      place_id?: number
      display_name?: string
      lon?: string
      lat?: string
    }
    if (data.result) return data.result
    if (!data.display_name || data.lon == null || data.lat == null) return null
    return {
      id: String(data.place_id ?? `${lon},${lat}`),
      label: data.display_name,
      lon: Number(data.lon),
      lat: Number(data.lat),
    }
  }
}
