import { useEffect, useId, useState } from 'react'
import {
  DEFAULT_MAX_DETOUR_M,
  DEFAULT_MAX_PHONES,
  DETOUR_STEP_M,
  DRIVE_MAX_DETOUR_M,
  MIN_DETOUR_M,
  UNCAPPED_MAX_PHONES,
  WALK_MAX_DETOUR_M,
} from '../lib/australia'
import type { PlaceResult, PlannedTrip } from '../lib/routing/types'
import {
  appleMapsUrl,
  formatDistance,
  formatDuration,
  googleMapsUrl,
} from '../lib/routing/waypoints'
import type { TravelMode } from '../lib/routing/travelMode'
import type { GeocodingProvider } from '../lib/routing/types'
import { PlaceAutocomplete } from './PlaceAutocomplete'

function detourSliderMax(mode: TravelMode): number {
  return mode === 'driving' ? DRIVE_MAX_DETOUR_M : WALK_MAX_DETOUR_M
}

/** Walking figure; decorative — button text keeps the accessible name. */
function WalkIcon() {
  return (
    <svg
      className="mode-toggle-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3.7 3.4L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.36-.54-.97-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7Z"
      />
    </svg>
  )
}

/** Side-view car; decorative — button text keeps the accessible name. */
function DriveIcon() {
  return (
    <svg
      className="mode-toggle-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99ZM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16Zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5ZM5 11l1.5-4.5h11L19 11H5Z"
      />
    </svg>
  )
}

type Props = {
  geocoder: GeocodingProvider
  phoneCount: number
  cacheFetchedAt?: string
  busy: boolean
  locating: boolean
  error: string | null
  trip: PlannedTrip | null
  origin: PlaceResult | null
  travelMode: TravelMode
  onTravelModeChange: (mode: TravelMode) => void
  onOriginChange: (place: PlaceResult | null) => void
  onUseLocation: () => void
  onRoute: (args: {
    origin: PlaceResult
    destination: PlaceResult
    maxPhones: number
    maxDetourM: number
    travelMode: TravelMode
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
  travelMode,
  onTravelModeChange,
  onOriginChange,
  onUseLocation,
  onRoute,
}: Props) {
  const originId = useId()
  const destId = useId()
  const fitAsManyId = useId()
  const modeGroupId = useId()
  const [destination, setDestination] = useState<PlaceResult | null>(null)
  const [fitAsManyAsDetour, setFitAsManyAsDetour] = useState(true)
  const [maxPhones, setMaxPhones] = useState(DEFAULT_MAX_PHONES)
  const [maxDetourM, setMaxDetourM] = useState(DEFAULT_MAX_DETOUR_M)
  const detourMax = detourSliderMax(travelMode)
  const modeForMaps = trip?.travelMode ?? travelMode
  const googleMaps = trip ? googleMapsUrl(trip.stops, modeForMaps) : null

  // Drive allows a higher ceiling; switching back to Walk clamps over-budget values.
  useEffect(() => {
    setMaxDetourM((v) => Math.min(v, detourSliderMax(travelMode)))
  }, [travelMode])

  return (
    <section className="trip-panel" aria-label="Plan a trip">
      <header className="brand-block">
        <p className="brand">Payphone Router</p>
        <h1>Australia routes. Tag phones on the way.</h1>
        <p className="lede">
          Nationwide A→B walking or driving routes that bend past nearby Telstra
          payphones for Payphone Tag.
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
        <div
          className="mode-toggle"
          role="group"
          aria-labelledby={modeGroupId}
        >
          <span id={modeGroupId} className="mode-toggle-label">
            Travel mode
          </span>
          <div className="mode-toggle-seg">
            <button
              type="button"
              className={travelMode === 'walking' ? 'active' : undefined}
              aria-pressed={travelMode === 'walking'}
              disabled={busy}
              onClick={() => onTravelModeChange('walking')}
            >
              <WalkIcon />
              Walk
            </button>
            <button
              type="button"
              className={travelMode === 'driving' ? 'active' : undefined}
              aria-pressed={travelMode === 'driving'}
              disabled={busy}
              onClick={() => onTravelModeChange('driving')}
            >
              <DriveIcon />
              Drive
            </button>
          </div>
        </div>
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
          Max detour +{formatDistance(maxDetourM)}
          <input
            type="range"
            min={MIN_DETOUR_M}
            max={detourMax}
            step={DETOUR_STEP_M}
            value={Math.min(maxDetourM, detourMax)}
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
            travelMode,
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
              <span className="hint mode-badge">
                {' '}
                · {trip.travelMode === 'driving' ? 'Drive' : 'Walk'}
              </span>
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
                href={appleMapsUrl(trip.stops, modeForMaps)}
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
