import { useEffect, useState } from 'react'
import type { GeocodingProvider, PlaceResult } from '../lib/routing/types'
import { GeocodeError } from '../lib/routing/geocode-error'

const SEARCH_DEBOUNCE_MS = 450

type Props = {
  id: string
  label: string
  placeholder: string
  geocoder: GeocodingProvider
  selected: PlaceResult | null
  onSelect: (place: PlaceResult | null) => void
  emptyMessage?: string
}

export function PlaceAutocomplete({
  id,
  label,
  placeholder,
  geocoder,
  selected,
  onSelect,
  emptyMessage = 'No places found in Australia. Try a different name.',
}: Props) {
  const [query, setQuery] = useState(selected?.label ?? '')
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchedEmpty, setSearchedEmpty] = useState(false)

  // Sync input when parent sets origin (e.g. GPS reverse-geocode)
  useEffect(() => {
    if (selected?.label) {
      setQuery(selected.label)
      setSuggestions([])
      setSearchError(null)
      setSearchedEmpty(false)
      setSearching(false)
    }
  }, [selected])

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
        setSearchError(GeocodeError.userMessage(e) || 'Place search failed.')
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
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        aria-busy={searching}
        aria-describedby={
          searchError
            ? `${id}-error`
            : searchedEmpty
              ? `${id}-empty`
              : searching
                ? `${id}-status`
                : undefined
        }
        onChange={(e) => {
          setQuery(e.target.value)
          if (selected) onSelect(null)
        }}
      />
      {searching && (
        <p className="hint" id={`${id}-status`} role="status">
          Searching…
        </p>
      )}
      {searchError && (
        <p className="error search-feedback" id={`${id}-error`} role="alert">
          {searchError}
        </p>
      )}
      {!searching && !searchError && searchedEmpty && (
        <p className="hint" id={`${id}-empty`} role="status">
          {emptyMessage}
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
                  onSelect(s)
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
  )
}
