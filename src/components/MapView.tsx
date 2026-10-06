import { useEffect, useRef } from 'react'
import {
  LngLatBounds,
  Map,
  NavigationControl,
  type GeoJSONSource,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString, Point } from 'geojson'
import { SYDNEY_CENTER } from '../lib/sydney'
import type { PlannedTrip } from '../lib/routing/types'

/** Free vector style (no API key). Swap for Mapbox style URL later. */
const TILE_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

type Props = {
  phonesGeojson: FeatureCollection<Point> | null
  trip: PlannedTrip | null
  showDirect: boolean
  userLocation: { lon: number; lat: number } | null
}

export function MapView({
  phonesGeojson,
  trip,
  showDirect,
  userLocation,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: SYDNEY_CENTER,
      zoom: 12.2,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    map.on('load', () => {
      map.addSource('payphones', {
        type: 'geojson',
        data: emptyPoints(),
      })
      map.addLayer({
        id: 'payphones-circle',
        type: 'circle',
        source: 'payphones',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            3.5,
            14,
            6.5,
            16,
            8,
          ],
          'circle-color': '#e8a317',
          'circle-stroke-color': '#1a1510',
          'circle-stroke-width': 1.25,
          'circle-opacity': 0.95,
        },
      })

      map.addSource('route-direct', {
        type: 'geojson',
        data: emptyLine(),
      })
      map.addLayer({
        id: 'route-direct',
        type: 'line',
        source: 'route-direct',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#8a7f72',
          'line-width': 3,
          'line-dasharray': [1.5, 1.5],
          'line-opacity': 0.75,
        },
      })

      map.addSource('route-via', {
        type: 'geojson',
        data: emptyLine(),
      })
      map.addLayer({
        id: 'route-via',
        type: 'line',
        source: 'route-via',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1f6b5a',
          'line-width': 5,
          'line-opacity': 0.95,
        },
      })

      map.addSource('stops', {
        type: 'geojson',
        data: emptyPoints(),
      })
      map.addLayer({
        id: 'stops-circle',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match',
            ['get', 'kind'],
            'origin',
            '#2f6fed',
            'destination',
            '#c23b22',
            '#e8a317',
          ],
          'circle-stroke-color': '#fff8ef',
          'circle-stroke-width': 2,
        },
      })

      map.addSource('user', {
        type: 'geojson',
        data: emptyPoints(),
      })
      map.addLayer({
        id: 'user-dot',
        type: 'circle',
        source: 'user',
        paint: {
          'circle-radius': 6,
          'circle-color': '#2f6fed',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !phonesGeojson) return
    const apply = () => {
      const src = map.getSource('payphones') as GeoJSONSource | undefined
      src?.setData(phonesGeojson)
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [phonesGeojson])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const directSrc = map.getSource('route-direct') as GeoJSONSource | undefined
      const viaSrc = map.getSource('route-via') as GeoJSONSource | undefined
      const stopsSrc = map.getSource('stops') as GeoJSONSource | undefined
      if (!trip) {
        directSrc?.setData(emptyLine())
        viaSrc?.setData(emptyLine())
        stopsSrc?.setData(emptyPoints())
        return
      }
      directSrc?.setData(
        showDirect
          ? lineFeature(trip.direct.coordinates)
          : emptyLine(),
      )
      viaSrc?.setData(lineFeature(trip.viaPhones.coordinates))
      stopsSrc?.setData({
        type: 'FeatureCollection',
        features: trip.stops.map((s) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [s.lon, s.lat],
          },
          properties: { kind: s.kind, label: s.label },
        })),
      })

      const bounds = new LngLatBounds()
      for (const c of trip.viaPhones.coordinates) bounds.extend(c)
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 48, bottom: 280, left: 36, right: 36 },
          maxZoom: 15.5,
          duration: 700,
        })
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [trip, showDirect])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const src = map.getSource('user') as GeoJSONSource | undefined
      if (!userLocation) {
        src?.setData(emptyPoints())
        return
      }
      src?.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [userLocation.lon, userLocation.lat],
            },
            properties: {},
          },
        ],
      })
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [userLocation])

  return <div className="map-plane" ref={containerRef} aria-label="Sydney map" />
}

function emptyPoints(): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: [] }
}

function emptyLine(): FeatureCollection<LineString> {
  return { type: 'FeatureCollection', features: [] }
}

function lineFeature(
  coordinates: [number, number][],
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: {},
      },
    ],
  }
}
