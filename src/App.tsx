import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import { MapView } from './components/MapView'
import { TripPanel } from './components/TripPanel'
import { loadAustraliaPayphones } from './lib/payphones'
import { createDirections, createGeocoder } from './lib/routing/providers'
import { planTripViaPayphones } from './lib/routing/waypoints'
import type { PayphoneFeature, PlaceResult, PlannedTrip } from './lib/routing/types'
import { isInAustralia } from './lib/australia'
import './styles/app.css'

export default function App() {
  const geocoder = useMemo(() => createGeocoder(), [])
  const directions = useMemo(() => createDirections(), [])

  const [phonesGeojson, setPhonesGeojson] =
    useState<FeatureCollection<Point> | null>(null)
  const [phones, setPhones] = useState<PayphoneFeature[]>([])
  const [cacheFetchedAt, setCacheFetchedAt] = useState<string>()
  const [origin, setOrigin] = useState<PlaceResult | null>(null)
  const [locating, setLocating] = useState(false)
  const [trip, setTrip] = useState<PlannedTrip | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { geojson, phones: list } = await loadAustraliaPayphones()
        if (cancelled) return
        setPhonesGeojson(geojson)
        setPhones(list)
        setCacheFetchedAt(geojson.properties?.fetchedAt)
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Could not load payphone cache',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onUseLocation = () => {
    setError(null)
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lon = pos.coords.longitude
        const lat = pos.coords.latitude
        if (!isInAustralia(lon, lat)) {
          setLocating(false)
          setError(
            'Your location looks outside Australia. This app only routes within AU.',
          )
          return
        }
        let label = `${lat.toFixed(5)}, ${lon.toFixed(5)}`
        try {
          const place = await geocoder.reverse?.(lon, lat)
          if (place?.label) label = place.label
        } catch {
          // keep coordinate label
        }
        setOrigin({
          id: `gps:${lon.toFixed(5)},${lat.toFixed(5)}`,
          label,
          lon,
          lat,
        })
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setError(err.message || 'Could not read location')
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const onRoute = async (args: {
    origin: PlaceResult
    destination: PlaceResult
    maxPhones: number
    maxDetourM: number
  }) => {
    setError(null)
    if (!isInAustralia(args.origin.lon, args.origin.lat)) {
      setError('Origin must be inside Australia.')
      return
    }
    if (!isInAustralia(args.destination.lon, args.destination.lat)) {
      setError('Destination must be inside Australia.')
      return
    }
    setBusy(true)
    try {
      const planned = await planTripViaPayphones(
        directions,
        {
          lon: args.origin.lon,
          lat: args.origin.lat,
          label: args.origin.label,
        },
        {
          lon: args.destination.lon,
          lat: args.destination.lat,
          label: args.destination.label,
        },
        phones,
        {
          maxPhones: args.maxPhones,
          maxDetourM: args.maxDetourM,
        },
      )
      setTrip(planned)
    } catch (e) {
      setTrip(null)
      setError(e instanceof Error ? e.message : 'Routing failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <MapView
        phonesGeojson={phonesGeojson}
        trip={trip}
        showDirect
        userLocation={
          origin ? { lon: origin.lon, lat: origin.lat } : null
        }
      />
      <TripPanel
        geocoder={geocoder}
        phoneCount={phones.length}
        cacheFetchedAt={cacheFetchedAt}
        busy={busy}
        locating={locating}
        error={error}
        trip={trip}
        origin={origin}
        onOriginChange={setOrigin}
        onUseLocation={onUseLocation}
        onRoute={onRoute}
      />
    </div>
  )
}
