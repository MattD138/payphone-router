/**
 * Upstream geocoding with in-memory cache + polite outbound throttle.
 * Default: Photon (komoot). Optional Nominatim fallback.
 * Swap later via GEOCODER_PROVIDER=mapbox (client/provider wiring).
 */

export type PlaceResult = {
  id: string
  label: string
  lon: number
  lat: number
}

export type GeocodeOk = {
  provider: string
  results: PlaceResult[]
}

export type GeocodeErr = {
  error: string
  code: 'rate_limited' | 'upstream' | 'bad_request'
  provider?: string
}

type CacheEntry = { at: number; body: GeocodeOk }

const USER_AGENT =
  process.env.HTTP_USER_AGENT ||
  'PayphoneRouter/0.2 (Australia walking router; contact: github.com/MattD138/payphone-router)'

const CONTACT_EMAIL = process.env.GEOCODER_EMAIL || ''

const PROVIDER = (process.env.GEOCODER_PROVIDER || 'photon').toLowerCase()
const PHOTON_BASE = process.env.PHOTON_BASE || 'https://photon.komoot.io'
const NOMINATIM_BASE =
  process.env.NOMINATIM_BASE || 'https://nominatim.openstreetmap.org'

const CACHE_TTL_MS = Number(process.env.GEOCODE_CACHE_TTL_MS) || 10 * 60 * 1000
const CACHE_MAX = 200
/** Photon is more tolerant than Nominatim; still serialize outbound calls. */
const MIN_INTERVAL_MS =
  Number(process.env.GEOCODE_MIN_INTERVAL_MS) ||
  (PROVIDER === 'nominatim' ? 1100 : 250)

const AU_BBOX = {
  minLon: 112.9,
  maxLon: 153.65,
  minLat: -43.75,
  maxLat: -10.05,
}

function isInAustralia(lon: number, lat: number): boolean {
  return (
    lon >= AU_BBOX.minLon &&
    lon <= AU_BBOX.maxLon &&
    lat >= AU_BBOX.minLat &&
    lat <= AU_BBOX.maxLat
  )
}

const cache = new Map<string, CacheEntry>()
let lastOutbound = 0
let chain: Promise<void> = Promise.resolve()

function uaHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  }
  if (CONTACT_EMAIL) headers['From'] = CONTACT_EMAIL
  return headers
}

async function throttleOutbound() {
  const run = async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastOutbound))
    if (wait) await new Promise((r) => setTimeout(r, wait))
    lastOutbound = Date.now()
  }
  const next = chain.then(run, run)
  chain = next.catch(() => {})
  await next
}

function cacheGet(key: string): GeocodeOk | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  // refresh LRU order
  cache.delete(key)
  cache.set(key, hit)
  return hit.body
}

function cacheSet(key: string, body: GeocodeOk) {
  cache.set(key, { at: Date.now(), body })
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

function photonLabel(props: Record<string, unknown>): string {
  const parts = [
    props.name,
    [props.housenumber, props.street].filter(Boolean).join(' '),
    props.locality || props.district,
    props.city,
    props.state,
    props.country,
  ]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  // de-dupe adjacent repeats
  const out: string[] = []
  for (const p of parts) {
    if (out[out.length - 1] !== p) out.push(p)
  }
  return out.join(', ') || 'Unknown place'
}

type PhotonFeature = {
  properties?: Record<string, unknown>
  geometry?: { type?: string; coordinates?: [number, number] }
}

async function searchPhoton(
  q: string,
  limit: number,
  bbox?: string,
): Promise<GeocodeOk> {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
    lang: 'en',
  })
  // Photon bbox: minLon,minLat,maxLon,maxLat
  params.set(
    'bbox',
    bbox ||
      `${AU_BBOX.minLon},${AU_BBOX.minLat},${AU_BBOX.maxLon},${AU_BBOX.maxLat}`,
  )
  await throttleOutbound()
  const upstream = await fetch(`${PHOTON_BASE}/api/?${params}`, {
    headers: uaHeaders(),
  })
  if (upstream.status === 429) {
    const err = new Error('Photon rate limited') as Error & {
      code: GeocodeErr['code']
      status: number
    }
    err.code = 'rate_limited'
    err.status = 429
    throw err
  }
  if (!upstream.ok) {
    const err = new Error(`Photon failed (${upstream.status})`) as Error & {
      code: GeocodeErr['code']
      status: number
    }
    err.code = 'upstream'
    err.status = upstream.status
    throw err
  }
  const data = (await upstream.json()) as { features?: PhotonFeature[] }
  const results: PlaceResult[] = (data.features || [])
    .map((f) => {
      const coords = f.geometry?.coordinates
      if (!coords || coords.length < 2) return null
      const [lon, lat] = coords
      const props = f.properties || {}
      const osmId = props.osm_id != null ? String(props.osm_id) : `${lon},${lat}`
      return {
        id: osmId,
        label: photonLabel(props),
        lon,
        lat,
      }
    })
    .filter((r): r is PlaceResult => r != null)
    .filter((r) => isInAustralia(r.lon, r.lat))
  return { provider: 'photon', results }
}

async function reversePhoton(lon: number, lat: number): Promise<PlaceResult | null> {
  const params = new URLSearchParams({
    lon: String(lon),
    lat: String(lat),
    lang: 'en',
  })
  await throttleOutbound()
  const upstream = await fetch(`${PHOTON_BASE}/reverse?${params}`, {
    headers: uaHeaders(),
  })
  if (!upstream.ok) return null
  const data = (await upstream.json()) as { features?: PhotonFeature[] }
  const f = data.features?.[0]
  if (!f?.geometry?.coordinates) return null
  const [rlon, rlat] = f.geometry.coordinates
  const props = f.properties || {}
  return {
    id: props.osm_id != null ? String(props.osm_id) : `${rlon},${rlat}`,
    label: photonLabel(props),
    lon: rlon,
    lat: rlat,
  }
}

async function searchNominatim(
  q: string,
  limit: number,
  viewbox?: string,
  bounded?: string,
): Promise<GeocodeOk> {
  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '0',
    limit: String(limit),
    countrycodes: 'au',
  })
  if (CONTACT_EMAIL) params.set('email', CONTACT_EMAIL)
  if (viewbox) params.set('viewbox', viewbox)
  else {
    params.set(
      'viewbox',
      `${AU_BBOX.minLon},${AU_BBOX.maxLat},${AU_BBOX.maxLon},${AU_BBOX.minLat}`,
    )
  }
  if (bounded != null) params.set('bounded', bounded)
  else params.set('bounded', '1')

  await throttleOutbound()
  const upstream = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: uaHeaders(),
  })
  if (upstream.status === 429) {
    const err = new Error('Nominatim rate limited') as Error & {
      code: GeocodeErr['code']
      status: number
    }
    err.code = 'rate_limited'
    err.status = 429
    throw err
  }
  if (!upstream.ok) {
    const err = new Error(`Nominatim failed (${upstream.status})`) as Error & {
      code: GeocodeErr['code']
      status: number
    }
    err.code = 'upstream'
    err.status = upstream.status
    throw err
  }
  const data = (await upstream.json()) as Array<{
    place_id: number
    display_name: string
    lon: string
    lat: string
  }>
  return {
    provider: 'nominatim',
    results: data.map((r) => ({
      id: String(r.place_id),
      label: r.display_name,
      lon: Number(r.lon),
      lat: Number(r.lat),
    })),
  }
}

async function reverseNominatim(
  lon: number,
  lat: number,
): Promise<PlaceResult | null> {
  const params = new URLSearchParams({
    lon: String(lon),
    lat: String(lat),
    format: 'json',
  })
  if (CONTACT_EMAIL) params.set('email', CONTACT_EMAIL)
  await throttleOutbound()
  const upstream = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
    headers: uaHeaders(),
  })
  if (!upstream.ok) return null
  const data = (await upstream.json()) as {
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

export async function geocodeSearch(args: {
  q: string
  limit?: number
  viewbox?: string
  bounded?: string
  bbox?: string
}): Promise<{ status: number; body: GeocodeOk | GeocodeErr }> {
  const q = args.q.trim()
  if (q.length < 2) {
    return {
      status: 400,
      body: { error: 'q required (min 2 chars)', code: 'bad_request' },
    }
  }
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10)
  const cacheKey = `s:${PROVIDER}:${q.toLowerCase()}:${limit}:${args.bbox || args.viewbox || 'au'}:${args.bounded ?? '1'}`
  const cached = cacheGet(cacheKey)
  if (cached) return { status: 200, body: cached }

  try {
    let body: GeocodeOk
    if (PROVIDER === 'nominatim') {
      body = await searchNominatim(q, limit, args.viewbox, args.bounded)
    } else {
      // photon (default). viewbox from client is Nominatim order; convert if present.
      let bbox = args.bbox
      if (!bbox && args.viewbox) {
        const [minLon, maxLat, maxLon, minLat] = String(args.viewbox)
          .split(',')
          .map(Number)
        if ([minLon, maxLat, maxLon, minLat].every(Number.isFinite)) {
          bbox = `${minLon},${minLat},${maxLon},${maxLat}`
        }
      }
      try {
        body = await searchPhoton(q, limit, bbox)
      } catch (primary) {
        // One polite Nominatim attempt if Photon is rate-limited.
        const code = (primary as { code?: string }).code
        if (code === 'rate_limited') {
          body = await searchNominatim(q, limit, args.viewbox, args.bounded)
        } else {
          throw primary
        }
      }
    }
    cacheSet(cacheKey, body)
    return { status: 200, body }
  } catch (e) {
    const code =
      (e as { code?: GeocodeErr['code'] }).code === 'rate_limited'
        ? 'rate_limited'
        : 'upstream'
    const status =
      code === 'rate_limited'
        ? 429
        : Number((e as { status?: number }).status) || 502
    return {
      status,
      body: {
        error:
          e instanceof Error ? e.message : 'Geocode upstream failed',
        code,
        provider: PROVIDER,
      },
    }
  }
}

export async function geocodeReverse(args: {
  lon: string
  lat: string
}): Promise<{
  status: number
  body: { provider: string; result: PlaceResult | null } | GeocodeErr
}> {
  const lon = Number(args.lon)
  const lat = Number(args.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return {
      status: 400,
      body: { error: 'lon and lat required', code: 'bad_request' },
    }
  }
  const cacheKey = `r:${PROVIDER}:${lon.toFixed(5)},${lat.toFixed(5)}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    return {
      status: 200,
      body: { provider: cached.provider, result: cached.results[0] ?? null },
    }
  }
  try {
    const result =
      PROVIDER === 'nominatim'
        ? await reverseNominatim(lon, lat)
        : await reversePhoton(lon, lat)
    const body = {
      provider: PROVIDER === 'nominatim' ? 'nominatim' : 'photon',
      results: result ? [result] : [],
    }
    cacheSet(cacheKey, body)
    return {
      status: 200,
      body: { provider: body.provider, result },
    }
  } catch (e) {
    const code =
      (e as { code?: GeocodeErr['code'] }).code === 'rate_limited'
        ? 'rate_limited'
        : 'upstream'
    return {
      status: code === 'rate_limited' ? 429 : 502,
      body: {
        error:
          e instanceof Error ? e.message : 'Reverse geocode failed',
        code,
        provider: PROVIDER,
      },
    }
  }
}

export function geocodeMeta() {
  return {
    provider: PROVIDER === 'nominatim' ? 'nominatim' : 'photon',
    cacheSize: cache.size,
    minIntervalMs: MIN_INTERVAL_MS,
  }
}
