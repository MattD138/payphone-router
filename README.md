# Payphone Router

Mobile-first PWA: walk A→B in **Sydney** while detouring past nearby Telstra payphones for [Payphone Tag](https://payphonetag.com/).

**Stack (v0):** Vite + React + TypeScript, MapLibre (OSM raster tiles), FOSSGIS public OSRM **foot** profile (`routing.openstreetmap.de/routed-foot` — not `router.project-osrm.org`, which is car-only), Photon geocoding via Express proxy (Nominatim optional; in-memory cache + throttle), cached Payphone Tag `/api/payphones` filtered to Greater Sydney. No paid API keys. Override with `OSRM_BASE`. Mapbox can replace geocode/directions later via `src/lib/routing/providers.ts` / `GEOCODER_PROVIDER`.

## Run locally

```bash
cd payphone-router
npm install
npm run fetch-phones   # optional refresh of public/data/sydney-payphones.geojson
npm run dev            # API on :3000, Vite on :5173 (proxies /api)
```

Open `http://localhost:5173` (or your LAN IP on iPhone).

Production-style:

```bash
npm run build
npm start              # serves dist + API on 0.0.0.0:$PORT (default 3000)
```

## iPhone Safari notes

1. Use HTTPS or localhost; geolocation needs a secure context (LAN IP over HTTP may be blocked — tunnel or deploy to Render).
2. Tap **Use my location**, allow permission, search a Sydney destination, **Route via payphones**.
3. Add to Home Screen via Share → Add to Home Screen (manifest + icons included).
4. **Open in Apple Maps** / **Open in Google Maps** use walking directions with the same intermediate payphone waypoints where each app’s URL scheme accepts them (Google Maps URLs cap at 9 vias; extras are omitted with a UI note).
5. OSM tiles / FOSSGIS OSRM foot / Photon are rate-limited — fine for personal MVP, not heavy production.

## Render

See `render.yaml`. Binds `0.0.0.0:$PORT`. Refresh phones with `npm run fetch-phones` in CI or a cron later — do not hammer Payphone Tag.

## Defaults

| Control | Default |
| --- | --- |
| Max phones (N) | 3 |
| Max detour | +800 m |
| Game filters | phones only (no PIN/login) |
| Bbox | lon 150.5–151.4, lat −34.2–−33.4 |
