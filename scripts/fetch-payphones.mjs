#!/usr/bin/env node
/**
 * Polite one-shot (or cron) fetch of Payphone Tag /api/payphones,
 * all active phones in Australia → public/data/australia-payphones.geojson
 *
 * Do not hammer the upstream API. Daily refresh is enough for locations.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(__dirname, '../public/data/australia-payphones.geojson')

/** Soft bounds — drop obvious bad coords; game phones are AU-only. */
const AU_BBOX = { minLon: 112.9, maxLon: 153.65, minLat: -43.75, maxLat: -10.05 }
const UA =
  process.env.HTTP_USER_AGENT ||
  'PayphoneRouter/0.2 (AU cache builder; polite; contact via repo)'

const res = await fetch('https://payphonetag.com/api/payphones', {
  headers: { Accept: 'application/json', 'User-Agent': UA },
})
if (!res.ok) {
  console.error('Upstream failed', res.status, await res.text())
  process.exit(1)
}

const raw = await res.json()
const phones = raw.payphones || []
const features = []
for (const p of phones) {
  const [id, lon, lat, holderId, status] = p
  if (status !== 'active') continue
  if (
    lon < AU_BBOX.minLon ||
    lon > AU_BBOX.maxLon ||
    lat < AU_BBOX.minLat ||
    lat > AU_BBOX.maxLat
  ) {
    continue
  }
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      id,
      holderId: holderId ?? null,
      status,
      name: `Payphone #${id}`,
    },
  })
}

const geojson = {
  type: 'FeatureCollection',
  properties: {
    source: 'https://payphonetag.com/api/payphones',
    fetchedAt: new Date().toISOString(),
    bbox: AU_BBOX,
    filter: 'Australia active only (Payphone Tag API)',
    count: features.length,
  },
  features,
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(geojson))
console.log(`Wrote ${features.length} phones → ${out}`)
