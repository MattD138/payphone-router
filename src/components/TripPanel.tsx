import { useEffect, useId, useState } from 'react'
import {
  DEFAULT_MAX_DETOUR_M,
  DEFAULT_MAX_PHONES,
} from '../lib/sydney'
import type { PlaceResult, PlannedTrip } from '../lib/routing/types'
import {
  appleMapsUrl,
  formatDistance,
  formatDuration,
} from '../lib/routing/waypoints'
import type { GeocodingProvider } from '../lib/routing/types'

type Props = {
  geocoder: GeocodingProvider
  phoneCount: number
  cacheFetchedAt?: string
  busy: boolean
  error: string | null
  trip: PlannedTrip | null
  originLabel: string
  onUseLocation: () => void
  onRoute: (args: {
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
  error,
  trip,
  originLabel,
  onUseLocation,
  onRoute,
}: Props) {
  const destId = useId()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([])
  const [selected, setSelected] = useState<PlaceResult | null>(null)
  const [maxPhones, setMaxPhones] = useState(DEFAULT_MAX_PHONES)
  const [maxDetourM, setMaxDetourM] = useState(DEFAULT_MAX_DETOUR_M)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.trim().length < 3 || selected?.label === query) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const t = window.setTimeout(async () => {
      setSearching(true)
      try {
        const results = await geocoder.search(query, { limit: 5 })
        if (!cancelled) setSuggestions(results)
      } catch {
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, geocoder, selected])

  return (
    <section className="trip-panel" aria-label="Plan a walk">
      <header className="brand-block">
        <p className="brand">Payphone Router</p>
        <h1>Walk Sydney. Tag phones on the way.</h1>
        <p className="lede">
          A→B walking routes that bend past nearby Telstra payphones for Payphone
          Tag.
        </p>
      </header>

      <div className="field">
        <span className="label">Origin</span>
        <button type="button" className="btn ghost" onClick={onUseLocation}>
          Use my location
        </button>
        <p className="hint">{originLabel}</p>
      </div>

      <div className="field">
        <label className="label" htmlFor={destId}>
          Destination
        </label>
        <input
          id={destId}
          className="input"
          placeholder="e.g. Circular Quay, Surry Hills…"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
          }}
        />
        {searching && <p className="hint">Searching…</p>}
        {suggestions.length > 0 && (
          <ul className="suggest">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(s)
                    setQuery(s.label)
                    setSuggestions([])
                  }}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="controls">
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
        disabled={busy || !selected}
        onClick={() => {
          if (!selected) return
          onRoute({ destination: selected, maxPhones, maxDetourM })
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
          <a
            className="btn secondary"
            href={appleMapsUrl(trip.stops)}
            target="_blank"
            rel="noreferrer"
          >
            Open in Apple Maps
          </a>
        </div>
      )}

      <p className="meta">
        {phoneCount.toLocaleString()} active Sydney phones
        {cacheFetchedAt
          ? ` · cache ${new Date(cacheFetchedAt).toLocaleDateString()}`
          : ''}
      </p>
    </section>
  )
}
