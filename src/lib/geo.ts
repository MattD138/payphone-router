export type LngLat = { lon: number; lat: number }

const R = 6371000

export function haversineM(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Approximate point-to-polyline distance in meters (great-circle). */
export function distanceToPolylineM(
  point: LngLat,
  line: [number, number][],
): number {
  if (line.length === 0) return Infinity
  if (line.length === 1) {
    return haversineM(point, { lon: line[0][0], lat: line[0][1] })
  }
  let min = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const d = distanceToSegmentM(
      point,
      { lon: line[i][0], lat: line[i][1] },
      { lon: line[i + 1][0], lat: line[i + 1][1] },
    )
    if (d < min) min = d
  }
  return min
}

function distanceToSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  // Local equirectangular projection around segment midpoint
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180)
  const cos = Math.cos(midLat)
  const ax = a.lon * cos
  const ay = a.lat
  const bx = b.lon * cos
  const by = b.lat
  const px = p.lon * cos
  const py = p.lat
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / len2
    t = Math.max(0, Math.min(1, t))
  }
  const cx = ax + t * dx
  const cy = ay + t * dy
  return haversineM(p, { lon: cx / cos, lat: cy })
}

/** Project progress along polyline [0..1] for ordering waypoints. */
export function progressAlongPolyline(
  point: LngLat,
  line: [number, number][],
): number {
  if (line.length < 2) return 0
  let bestT = 0
  let bestD = Infinity
  let cum = 0
  const segs: number[] = [0]
  for (let i = 0; i < line.length - 1; i++) {
    cum += haversineM(
      { lon: line[i][0], lat: line[i][1] },
      { lon: line[i + 1][0], lat: line[i + 1][1] },
    )
    segs.push(cum)
  }
  const total = cum || 1
  for (let i = 0; i < line.length - 1; i++) {
    const a = { lon: line[i][0], lat: line[i][1] }
    const b = { lon: line[i + 1][0], lat: line[i + 1][1] }
    const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180)
    const cos = Math.cos(midLat)
    const ax = a.lon * cos
    const ay = a.lat
    const bx = b.lon * cos
    const by = b.lat
    const px = point.lon * cos
    const py = point.lat
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    let t = 0
    if (len2 > 0) {
      t = ((px - ax) * dx + (py - ay) * dy) / len2
      t = Math.max(0, Math.min(1, t))
    }
    const cx = ax + t * dx
    const cy = ay + t * dy
    const d = haversineM(point, { lon: cx / cos, lat: cy })
    if (d < bestD) {
      bestD = d
      const segLen = segs[i + 1] - segs[i]
      bestT = (segs[i] + t * segLen) / total
    }
  }
  return bestT
}
