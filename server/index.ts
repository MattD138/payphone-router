import compression from 'compression'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geocodeMeta, geocodeReverse, geocodeSearch } from './geocode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const dataFile = path.join(root, 'public', 'data', 'australia-payphones.geojson')

const PORT = Number(process.env.PORT) || 3000
const USER_AGENT =
  process.env.HTTP_USER_AGENT ||
  'PayphoneRouter/0.2 (Australia walking router; contact: github.com/MattD138/payphone-router)'

// project-osrm.org only hosts a car graph — /foot there still returns driving
// geometry. FOSSGIS runs real foot + car profiles (planet, incl. Australia).
const OSRM_FOOT_BASE =
  process.env.OSRM_BASE ||
  process.env.OSRM_FOOT_BASE ||
  'https://routing.openstreetmap.de/routed-foot/route/v1/foot'

const OSRM_CAR_BASE =
  process.env.OSRM_CAR_BASE ||
  'https://routing.openstreetmap.de/routed-car/route/v1/driving'

type OsrmProfile = 'foot' | 'driving'

function resolveProfile(raw: unknown): OsrmProfile {
  const v = String(raw || 'foot').toLowerCase()
  if (v === 'driving' || v === 'car' || v === 'drive') return 'driving'
  // walking / walk / foot / default
  return 'foot'
}

function osrmBaseFor(profile: OsrmProfile): string {
  return profile === 'driving' ? OSRM_CAR_BASE : OSRM_FOOT_BASE
}

const app = express()
app.disable('x-powered-by')
app.use(compression())
app.use(cors())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'payphone-router',
    geocode: geocodeMeta(),
    routing: {
      defaultProfile: 'foot',
      profiles: {
        foot: {
          provider: 'fossgis-osrm-foot',
          base: OSRM_FOOT_BASE,
        },
        driving: {
          provider: 'fossgis-osrm-car',
          base: OSRM_CAR_BASE,
        },
      },
      // Back-compat fields (foot default)
      profile: 'foot',
      provider: 'fossgis-osrm-foot',
      base: OSRM_FOOT_BASE,
    },
  })
})

app.get('/api/payphones', (_req, res) => {
  if (!fs.existsSync(dataFile)) {
    res.status(503).json({ error: 'Australia payphone cache missing' })
    return
  }
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.sendFile(dataFile)
})

app.get('/api/geocode', async (req, res) => {
  const result = await geocodeSearch({
    q: String(req.query.q || ''),
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    viewbox: req.query.viewbox ? String(req.query.viewbox) : undefined,
    bounded: req.query.bounded ? String(req.query.bounded) : undefined,
    bbox: req.query.bbox ? String(req.query.bbox) : undefined,
  })
  res.status(result.status).json(result.body)
})

app.get('/api/geocode/reverse', async (req, res) => {
  const result = await geocodeReverse({
    lon: String(req.query.lon || ''),
    lat: String(req.query.lat || ''),
  })
  res.status(result.status).json(result.body)
})

/**
 * OSRM proxy. Optional `?profile=foot|driving` (also accepts walk/walking/car/drive).
 * Omitting profile keeps the historical foot default so existing clients keep working.
 */
app.get('/api/route/:coords', async (req, res) => {
  const coords = req.params.coords
  if (!coords || !coords.includes(';')) {
    res.status(400).json({ error: 'coords as lon,lat;lon,lat… required' })
    return
  }
  const profile = resolveProfile(req.query.profile)
  const base = osrmBaseFor(profile)
  try {
    const params = new URLSearchParams({
      overview: String(req.query.overview || 'full'),
      geometries: String(req.query.geometries || 'geojson'),
      steps: String(req.query.steps || 'false'),
    })
    const upstream = await fetch(`${base}/${coords}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
    const body = await upstream.text()
    res.status(upstream.status).type('json').send(body)
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'OSRM upstream failed',
    })
  }
})

if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false, fallthrough: true }))
  // Never SPA-fallback missing hashed assets — browsers reject HTML as JS modules
  // (e.g. MapLibre worker), which previously blanked the map.
  app.use('/assets', (_req, res) => {
    res.status(404).type('text/plain').send('Not found')
  })
  // Same for PWA/static files Safari probes (apple-touch-icon, favicon.ico, etc.)
  app.get(
    /\.(?:png|jpe?g|gif|webp|ico|svg|webmanifest|json|js|mjs|css|map|txt|xml)$/i,
    (_req, res) => {
      res.status(404).type('text/plain').send('Not found')
    },
  )
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
} else {
  // Dev convenience: serve public/ when dist missing
  app.use(express.static(path.join(root, 'public')))
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Payphone Router listening on http://0.0.0.0:${PORT}`)
})
