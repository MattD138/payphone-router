import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import { MapView } from './components/MapView'
import { TripPanel } from './components/TripPanel'
import { loadSydneyPayphones } from './lib/payphones'
import { createDirections, createGeocoder } from './lib/routing/providers'
import { planTripViaPayphones } from './lib/routing/waypoints'
import type { PayphoneFeature, PlaceResult, PlannedTrip } from './lib/routing/types'
import { isInSydney } from './lib/sydney'
import './styles/app.css'

export default function App() {
  const geocoder = useMemo(() => createGeocoder(), [])
  const directions = useMemo(() => createDirections(), [])

  const [phonesGeojson, setPhonesGeojson] =
    useState<FeatureCollection<Point> | null>(null)
  const [phones, setPhones] = useState<PayphoneFeature[]>([])
  const [cacheFetchedAt, setCacheFetchedAt] = useState<string>()
  const [userLocation, setUserLocation] = useState<{
    lon: number
    lat: number
  } | null>(null)
  const [originLabel, setOriginLabel] = useState(
    'Tap “Use my location” (Sydney only)',
  )
  const [trip, setTrip] = useState<PlannedTrip | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { geojson, phones: list } = await loadSydneyPayphones()
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
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lon = pos.coords.longitude
        const lat = pos.coords.latitude
        if (!isInSydney(lon, lat)) {
          setError(
            'MVP is Sydney-only. Your GPS is outside the Greater Sydney bbox.',
          )
          return
        }
        setUserLocation({ lon, lat })
        try {
          const place = await geocoder.reverse?.(lon, lat)
          setOriginLabel(place?.label ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`)
        } catch {
          setOriginLabel(`${lat.toFixed(5)}, ${lon.toFixed(5)}`)
        }
      },
      (err) => {
        setError(err.message || 'Could not read location')
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const onRoute = async (args: {
    destination: PlaceResult
    maxPhones: number
    maxDetourM: number
  }) => {
    setError(null)
    if (!userLocation) {
      setError('Set origin with “Use my location” first.')
      return
    }
    if (!isInSydney(args.destination.lon, args.destination.lat)) {
      setError('Destination must be inside Greater Sydney for this MVP.')
      return
    }
    setBusy(true)
    try {
      const planned = await planTripViaPayphones(
        directions,
        { ...userLocation, label: originLabel },
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
        userLocation={userLocation}
      />
      <TripPanel
        geocoder={geocoder}
        phoneCount={phones.length}
        cacheFetchedAt={cacheFetchedAt}
        busy={busy}
        error={error}
        trip={trip}
        originLabel={originLabel}
        onUseLocation={onUseLocation}
        onRoute={onRoute}
      />
    </div>
  )
}
