#!/usr/bin/env node
/**
 * Polite one-shot (or cron) fetch of Payphone Tag /api/payphones,
 * filtered to Greater Sydney active phones → public/data/sydney-payphones.geojson
 *
 * Do not hammer the upstream API. Daily refresh is enough for locations.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(__dirname, '../public/data/sydney-payphones.geojson')

const BBOX = { minLon: 150.5, maxLon: 151.4, minLat: -34.2, maxLat: -33.4 }
const UA =
  process.env.HTTP_USER_AGENT ||
  'PayphoneRouterMVP/0.1 (Sydney cache builder; polite; contact via repo)'

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
  if (
    lon < BBOX.minLon ||
    lon > BBOX.maxLon ||
    lat < BBOX.minLat ||
    lat > BBOX.maxLat
  ) {
    continue
  }
  if (status !== 'active') continue
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
    bbox: BBOX,
    filter: 'Greater Sydney active only',
    count: features.length,
  },
  features,
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(geojson))
console.log(`Wrote ${features.length} phones → ${out}`)
