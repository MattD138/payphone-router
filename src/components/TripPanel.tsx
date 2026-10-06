import { useId, useState } from 'react'
import {
  DEFAULT_MAX_DETOUR_M,
  DEFAULT_MAX_PHONES,
  UNCAPPED_MAX_PHONES,
} from '../lib/australia'
import type { PlaceResult, PlannedTrip } from '../lib/routing/types'
import {
  appleMapsUrl,
  formatDistance,
  formatDuration,
  googleMapsUrl,
} from '../lib/routing/waypoints'
import type { GeocodingProvider } from '../lib/routing/types'
import { PlaceAutocomplete } from './PlaceAutocomplete'

type Props = {
  geocoder: GeocodingProvider
  phoneCount: number
  cacheFetchedAt?: string
  busy: boolean
  locating: boolean
  error: string | null
  trip: PlannedTrip | null
  origin: PlaceResult | null
  onOriginChange: (place: PlaceResult | null) => void
  onUseLocation: () => void
  onRoute: (args: {
    origin: PlaceResult
    destination: PlaceResult
    maxPhones: number
    maxDetourM: number
  }) => void
}

export function TripPanel({
  geocoder,
  phoneCount,
  cacheFetchedAt,
  busy,
  locating,
  error,
  trip,
  origin,
  onOriginChange,
  onUseLocation,
  onRoute,
}: Props) {
  const originId = useId()
  const destId = useId()
  const fitAsManyId = useId()
  const [destination, setDestination] = useState<PlaceResult | null>(null)
  const [fitAsManyAsDetour, setFitAsManyAsDetour] = useState(true)
  const [maxPhones, setMaxPhones] = useState(DEFAULT_MAX_PHONES)
  const [maxDetourM, setMaxDetourM] = useState(DEFAULT_MAX_DETOUR_M)
  const googleMaps = trip ? googleMapsUrl(trip.stops) : null

  return (
    <section className="trip-panel" aria-label="Plan a walk">
      <header className="brand-block">
        <p className="brand">Payphone Router</p>
        <h1>Walk Australia. Tag phones on the way.</h1>
        <p className="lede">
          Nationwide A→B walking routes that bend past nearby Telstra payphones
          for Payphone Tag.
        </p>
      </header>

      <PlaceAutocomplete
        id={originId}
        label="Origin"
        placeholder="e.g. Melbourne Central, Brisbane City…"
        geocoder={geocoder}
        selected={origin}
        onSelect={onOriginChange}
      />
      <div className="origin-actions">
        <button
          type="button"
          className="btn ghost"
          onClick={onUseLocation}
          disabled={locating || busy}
          aria-busy={locating}
        >
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        {locating && (
          <p className="hint" role="status">
            Getting your GPS position…
          </p>
        )}
        {!locating && origin && (
          <p className="hint" role="status">
            Starting from {origin.label}
          </p>
        )}
        {!locating && !origin && (
          <p className="hint">Search a start place, or use GPS</p>
        )}
      </div>

      <PlaceAutocomplete
        id={destId}
        label="Destination"
        placeholder="e.g. Circular Quay, Surry Hills…"
        geocoder={geocoder}
        selected={destination}
        onSelect={setDestination}
      />

      <div className="controls">
        <label className="check" htmlFor={fitAsManyId}>
          <input
            id={fitAsManyId}
            type="checkbox"
            checked={fitAsManyAsDetour}
            onChange={(e) => setFitAsManyAsDetour(e.target.checked)}
          />
          <span>Fit as many phones as the detour allows</span>
        </label>
        {!fitAsManyAsDetour && (
          <label>
            Up to {maxPhones} phones
            <input
              type="range"
              min={1}
              max={5}
              value={maxPhones}
              onChange={(e) => setMaxPhones(Number(e.target.value))}
            />
          </label>
        )}
        <label>
          Max detour +{maxDetourM} m
          <input
            type="range"
            min={200}
            max={2000}
            step={100}
            value={maxDetourM}
            onChange={(e) => setMaxDetourM(Number(e.target.value))}
          />
        </label>
      </div>

      <button
        type="button"
        className="btn primary"
        disabled={busy || locating || !origin || !destination}
        onClick={() => {
          if (!origin || !destination) return
          onRoute({
            origin,
            destination,
            maxPhones: fitAsManyAsDetour ? UNCAPPED_MAX_PHONES : maxPhones,
            maxDetourM,
          })
        }}
      >
        {busy ? 'Routing…' : 'Route via payphones'}
      </button>

      {error && <p className="error" role="alert">{error}</p>}

      {trip && (
        <div className="results">
          <div className="summary">
            <p>
              <strong>{formatDistance(trip.viaPhones.distanceM)}</strong>
              <span> · {formatDuration(trip.viaPhones.durationS)}</span>
            </p>
            <p className="hint">
              {trip.selectedPhones.length} phone
              {trip.selectedPhones.length === 1 ? '' : 's'} · detour{' '}
              {formatDistance(trip.detourM)} vs direct{' '}
              {formatDistance(trip.direct.distanceM)}
            </p>
          </div>
          <ol className="stops">
            {trip.stops.map((s, i) => (
              <li key={`${s.kind}-${i}`}>
                <span className={`chip ${s.kind}`}>
                  {s.kind === 'payphone' ? '☎' : i === 0 ? 'A' : 'B'}
                </span>
                <span>{s.label}</span>
              </li>
            ))}
          </ol>
          {googleMaps && (
            <div className="map-exports">
              <a
                className="btn secondary"
                href={appleMapsUrl(trip.stops)}
                target="_blank"
                rel="noreferrer"
              >
                Open in Apple Maps
              </a>
              <a
                className="btn secondary"
                href={googleMaps.url}
                target="_blank"
                rel="noreferrer"
              >
                Open in Google Maps
              </a>
              {googleMaps.omittedWaypoints > 0 && (
                <p className="hint" role="note">
                  Google Maps allows 9 stops between A and B — last{' '}
                  {googleMaps.omittedWaypoints} payphone
                  {googleMaps.omittedWaypoints === 1 ? '' : 's'} omitted from
                  that link.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="meta">
        {phoneCount.toLocaleString()} active AU payphones
        {cacheFetchedAt
          ? ` · cache ${new Date(cacheFetchedAt).toLocaleDateString()}`
          : ''}
      </p>
    </section>
  )
}
