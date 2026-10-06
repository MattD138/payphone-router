import type { FeatureCollection, Point } from 'geojson'
import type { PayphoneFeature } from './routing/types'

export type PayphoneCollection = FeatureCollection<
  Point,
  {
    id: number
    holderId: number | null
    status: string
    name: string
  }
> & {
  properties?: {
    fetchedAt?: string
    count?: number
  }
}

export async function loadSydneyPayphones(): Promise<{
  geojson: PayphoneCollection
  phones: PayphoneFeature[]
}> {
  const res = await fetch('/data/sydney-payphones.geojson')
  if (!res.ok) throw new Error('Failed to load Sydney payphone cache')
  const geojson = (await res.json()) as PayphoneCollection
  const phones: PayphoneFeature[] = geojson.features.map((f) => ({
    id: f.properties.id,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    name: f.properties.name,
    holderId: f.properties.holderId,
    status: f.properties.status,
  }))
  return { geojson, phones }
}
