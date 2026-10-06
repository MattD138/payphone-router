import compression from 'compression'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const dataFile = path.join(root, 'public', 'data', 'sydney-payphones.geojson')

const PORT = Number(process.env.PORT) || 3000
const USER_AGENT =
  process.env.HTTP_USER_AGENT ||
  'PayphoneRouterMVP/0.1 (Sydney walking router; polite cache; contact via GitHub)'

const OSRM_BASE =
  process.env.OSRM_BASE || 'https://router.project-osrm.org/route/v1/foot'
const NOMINATIM_BASE =
  process.env.NOMINATIM_BASE || 'https://nominatim.openstreetmap.org'

const app = express()
app.disable('x-powered-by')
app.use(compression())
app.use(cors())

/** Polite in-memory throttle for upstream Nominatim (1 req/s guideline). */
let lastNominatim = 0
async function throttleNominatim() {
  const wait = Math.max(0, 1100 - (Date.now() - lastNominatim))
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastNominatim = Date.now()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'payphone-router' })
})

app.get('/api/payphones', (_req, res) => {
  if (!fs.existsSync(dataFile)) {
    res.status(503).json({ error: 'Sydney payphone cache missing' })
    return
  }
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.sendFile(dataFile)
})

app.get('/api/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) {
    res.status(400).json({ error: 'q required' })
    return
  }
  try {
    await throttleNominatim()
    const params = new URLSearchParams({
      q,
      format: 'json',
      addressdetails: '0',
      limit: String(req.query.limit || 5),
      countrycodes: 'au',
    })
    if (req.query.viewbox) params.set('viewbox', String(req.query.viewbox))
    if (req.query.bounded) params.set('bounded', String(req.query.bounded))
    const upstream = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
    const body = await upstream.text()
    res.status(upstream.status).type('json').send(body)
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'Geocode upstream failed',
    })
  }
})

app.get('/api/geocode/reverse', async (req, res) => {
  const lon = String(req.query.lon || '')
  const lat = String(req.query.lat || '')
  if (!lon || !lat) {
    res.status(400).json({ error: 'lon and lat required' })
    return
  }
  try {
    await throttleNominatim()
    const params = new URLSearchParams({
      lon,
      lat,
      format: 'json',
    })
    const upstream = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
    const body = await upstream.text()
    res.status(upstream.status).type('json').send(body)
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'Reverse geocode failed',
    })
  }
})

app.get('/api/route/:coords', async (req, res) => {
  const coords = req.params.coords
  if (!coords || !coords.includes(';')) {
    res.status(400).json({ error: 'coords as lon,lat;lon,lat… required' })
    return
  }
  try {
    const params = new URLSearchParams({
      overview: String(req.query.overview || 'full'),
      geometries: String(req.query.geometries || 'geojson'),
      steps: String(req.query.steps || 'false'),
    })
    const upstream = await fetch(`${OSRM_BASE}/${coords}?${params}`, {
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
  app.use(express.static(dist, { maxAge: '1h', index: false }))
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
