import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Run TypeScript modules via tsx register
const require = createRequire(import.meta.url)

const geo = JSON.parse(
  readFileSync(new URL('../public/data/australia-payphones.geojson', import.meta.url), 'utf8'),
)
const phones = geo.features.map((f) => ({
  id: f.properties.id,
  lon: f.geometry.coordinates[0],
  lat: f.geometry.coordinates[1],
  name: f.properties.name,
  holderId: f.properties.holderId,
  status: f.properties.status,
}))

const { OsrmDirections } = await import('../src/lib/routing/osrm.ts')
const { planTripViaPayphones, appleMapsUrl } = await import(
  '../src/lib/routing/waypoints.ts'
)

const directions = new OsrmDirections('http://127.0.0.1:3000/api/route')
const trip = await planTripViaPayphones(
  directions,
  { lon: 151.211, lat: -33.873, label: 'Hyde Park' },
  { lon: 151.215, lat: -33.8575, label: 'Opera House area' },
  phones,
  { maxPhones: 3, maxDetourM: 800 },
)
console.log(
  JSON.stringify(
    {
      phones: trip.selectedPhones.map((p) => p.id),
      directM: Math.round(trip.direct.distanceM),
      viaM: Math.round(trip.viaPhones.distanceM),
      detourM: Math.round(trip.detourM),
      stops: trip.stops.map((s) => s.kind),
      apple: appleMapsUrl(trip.stops),
    },
    null,
    2,
  ),
)
