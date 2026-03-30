import { useState, useRef } from 'react'
import { Polygon, Tooltip, useMapEvents } from 'react-leaflet'
import { useAirspaces } from '../../hooks/useAirspaces'
import { getAirspaceStyle } from '../../utils/airspaceStyle'
import type { Airspace, AirspaceClass } from '@flight-planner/shared'

function formatAlt(ft: number, ref: string): string {
  const displayFt = Math.min(ft, 10000)
  return `${displayFt.toLocaleString()} ft ${ref === 'FL' ? 'MSL' : ref}${ft > 10000 ? '+' : ''}`
}

function pointInPolygon(lat: number, lon: number, coords: number[][]): boolean {
  let inside = false
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1]
    const xj = coords[j][0], yj = coords[j][1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// Shoelace formula — coords are [lon, lat], returns relative area (no units needed)
function polygonArea(coords: number[][]): number {
  let area = 0
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    area += (coords[j][0] + coords[i][0]) * (coords[j][1] - coords[i][1])
  }
  return Math.abs(area / 2)
}

function smallestAirspaceAt(lat: number, lon: number, airspaces: Airspace[]): string | null {
  const hits = airspaces
    .filter(a => pointInPolygon(lat, lon, a.boundary.coordinates[0]))
    .filter(a => a.airspaceClass !== 'G' && a.airspaceClass !== 'F')
  if (hits.length === 0) return null
  return hits.reduce((best, a) =>
    polygonArea(a.boundary.coordinates[0]) < polygonArea(best.boundary.coordinates[0]) ? a : best
  ).id
}

// useMapEvents registers handlers once on mount (empty deps internally) so
// we must use a ref to avoid a stale closure over the airspaces array.
function AirspaceHoverTracker({ airspacesRef, onHighlight }: {
  airspacesRef: React.RefObject<Airspace[]>
  onHighlight: (id: string | null) => void
}) {
  useMapEvents({
    mousemove: (e) => {
      const { lat, lng } = e.latlng
      onHighlight(smallestAirspaceAt(lat, lng, airspacesRef.current ?? []))
    },
    mouseout: () => onHighlight(null),
  })
  return null
}

export default function AirspacesLayer() {
  const { data: airspaces } = useAirspaces()
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  // Keep a ref so the map event handler (registered once) always sees fresh data
  const airspacesRef = useRef<Airspace[]>([])
  airspacesRef.current = airspaces?.filter(a => a.lowerLimitFt <= 10000) ?? []

  if (!airspaces) return null

  const visibleAirspaces = airspaces.filter(a => a.lowerLimitFt <= 10000)

  return (
    <>
      <AirspaceHoverTracker airspacesRef={airspacesRef} onHighlight={setHighlightedId} />
      {visibleAirspaces.map(airspace => {
        const style = getAirspaceStyle(airspace.airspaceClass as AirspaceClass)
        const positions = airspace.boundary.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number])
        const isHighlighted = airspace.id === highlightedId

        return (
          <Polygon
            key={airspace.id}
            positions={positions}
            pathOptions={isHighlighted ? { ...style, fillOpacity: 0.35, weight: 3, opacity: 1 } : style}
          >
            {isHighlighted && (
              <Tooltip sticky>
                <div className="text-xs">
                  <div className="font-bold">{airspace.name}</div>
                  <div>Class {airspace.airspaceClass}</div>
                  <div>{formatAlt(airspace.lowerLimitFt, airspace.lowerLimitRef)} – {formatAlt(airspace.upperLimitFt, airspace.upperLimitRef)}</div>
                </div>
              </Tooltip>
            )}
          </Polygon>
        )
      })}
    </>
  )
}
