import { useEffect, useId, useState } from 'react'
import {
  DEFAULT_MAX_DETOUR_M,
  DEFAULT_MAX_PHONES,
  UNCAPPED_MAX_PHONES,
} from '../lib/sydney'
import type { PlaceResult, PlannedTrip } from '../lib/routing/types'
import {
  appleMapsUrl,
  formatDistance,
  formatDuration,
} from '../lib/routing/waypoints'
import type { GeocodingProvider } from '../lib/routing/types'
import { GeocodeError } from '../lib/routing/geocode-error'

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

const SEARCH_DEBOUNCE_MS = 450

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
  const fitAsManyId = useId()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([])
  const [selected, setSelected] = useState<PlaceResult | null>(null)
  const [fitAsManyAsDetour, setFitAsManyAsDetour] = useState(true)
  const [maxPhones, setMaxPhones] = useState(DEFAULT_MAX_PHONES)
  const [maxDetourM, setMaxDetourM] = useState(DEFAULT_MAX_DETOUR_M)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchedEmpty, setSearchedEmpty] = useState(false)

  useEffect(() => {
    if (query.trim().length < 3 || selected?.label === query) {
      setSuggestions([])
      setSearchError(null)
      setSearchedEmpty(false)
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)
    setSearchError(null)
    setSearchedEmpty(false)

    const t = window.setTimeout(async () => {
      try {
        const results = await geocoder.search(query, {
          limit: 5,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        setSuggestions(results)
        setSearchedEmpty(results.length === 0)
        setSearchError(null)
      } catch (e) {
        if (controller.signal.aborted) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        setSuggestions([])
        setSearchedEmpty(false)
        setSearchError(GeocodeError.userMessage(e) || 'Destination search failed.')
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
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
          aria-busy={searching}
          aria-describedby={
            searchError
              ? `${destId}-error`
              : searchedEmpty
                ? `${destId}-empty`
                : searching
                  ? `${destId}-status`
                  : undefined
          }
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
          }}
        />
        {searching && (
          <p className="hint" id={`${destId}-status`} role="status">
            Searching…
          </p>
        )}
        {searchError && (
          <p className="error search-feedback" id={`${destId}-error`} role="alert">
            {searchError}
          </p>
        )}
        {!searching && !searchError && searchedEmpty && (
          <p className="hint" id={`${destId}-empty`} role="status">
            No places found in Greater Sydney. Try a different name.
          </p>
        )}
        {suggestions.length > 0 && (
          <ul className="suggest" role="listbox">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  onClick={() => {
                    setSelected(s)
                    setQuery(s.label)
                    setSuggestions([])
                    setSearchedEmpty(false)
                    setSearchError(null)
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
        disabled={busy || !selected}
        onClick={() => {
          if (!selected) return
          onRoute({
            destination: selected,
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
