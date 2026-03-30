import { useState, useEffect } from 'react'
import { useMapEvents } from 'react-leaflet'
import { useAirspaces } from '../../hooks/useAirspaces'
import type { Airspace, AirspaceClass } from '@flight-planner/shared'

interface ClickInfo {
  lat: number
  lon: number
  x: number  // pixel offset from map container left
  y: number  // pixel offset from map container top
  airspaces: Airspace[]
}

function pointInPolygon(lat: number, lon: number, coords: number[][]): boolean {
  let inside = false
  const x = lon, y = lat
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1]
    const xj = coords[j][0], yj = coords[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function formatAlt(ft: number, ref: string): string {
  return `${ft} ft ${ref === 'FL' ? 'MSL' : ref}`
}

function airspaceClassColor(cls: AirspaceClass): string {
  switch (cls) {
    case 'A': case 'B': return 'bg-red-500'
    case 'C': case 'D': return 'bg-blue-500'
    case 'E': return 'bg-fuchsia-500'
    default: return 'bg-gray-500'
  }
}

interface InnerProps {
  airspaces: Airspace[]
  onInfo: (info: ClickInfo) => void
}

function MapClickInner({ airspaces, onInfo }: InnerProps) {
  useMapEvents({
    dblclick: (e) => {
      const { lat, lng: lon } = e.latlng
      const { x, y } = e.containerPoint
      const matched = airspaces
        .filter(a => a.lowerLimitFt <= 10000 && pointInPolygon(lat, lon, a.boundary.coordinates[0]))
        .sort((a, b) => a.lowerLimitFt - b.lowerLimitFt)
      onInfo({ lat, lon, x, y, airspaces: matched })
    },
  })
  return null
}

export default function MapClickInfo() {
  const [info, setInfo] = useState<ClickInfo | null>(null)
  const { data: airspaces = [] } = useAirspaces()

  useEffect(() => {
    if (!info) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfo(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [info])

  return (
    <>
      <MapClickInner airspaces={airspaces} onInfo={setInfo} />
      {info && (
        <div
          className="absolute z-[800] bg-fp-panel border border-fp-border rounded shadow-lg min-w-52 max-w-64 text-fp-text"
          style={{ left: info.x + 8, top: info.y + 8 }}
        >
          <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-fp-border">
            <span className="text-xs font-mono text-fp-muted">
              {info.lat.toFixed(4)}, {info.lon.toFixed(4)}
            </span>
            <button
              onClick={() => setInfo(null)}
              className="text-fp-muted hover:text-fp-text text-sm leading-none ml-2"
            >
              ✕
            </button>
          </div>
          <div className="p-2">
            {info.airspaces.length === 0 ? (
              <div className="text-xs text-fp-muted">No controlled airspace</div>
            ) : (
              <ul className="space-y-1.5">
                {info.airspaces.map(a => (
                  <li key={a.id} className="flex items-start gap-1.5 text-xs">
                    <span className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${airspaceClassColor(a.airspaceClass)}`} />
                    <span className="font-mono font-bold">{a.airspaceClass}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{a.name}</span>
                      <span className="text-fp-muted">
                        {formatAlt(a.lowerLimitFt, a.lowerLimitRef)} – {formatAlt(a.upperLimitFt, a.upperLimitRef)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
