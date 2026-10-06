import { NominatimGeocoder } from './nominatim'
import { OsrmDirections } from './osrm'
import type { DirectionsProvider, GeocodingProvider } from './types'

/**
 * Central provider wiring. To swap in Mapbox later:
 * - implement MapboxGeocodingProvider / MapboxDirectionsProvider
 * - set VITE_GEOCODER=mapbox / VITE_DIRECTIONS=mapbox + token
 */
export function createGeocoder(): GeocodingProvider {
  return new NominatimGeocoder()
}

export function createDirections(): DirectionsProvider {
  return new OsrmDirections()
}
