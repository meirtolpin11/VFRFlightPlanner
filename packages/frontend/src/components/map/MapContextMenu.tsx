import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMapEvents } from 'react-leaflet'
import { useUiStore } from '../../store/uiStore'
import { useTripStore } from '../../store/tripStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useAirspaces } from '../../hooks/useAirspaces'
import { api } from '../../services/api'
import { insertAtOptimalPosition } from '../../utils/legCalc'
import type { Airspace, AirspaceClass } from '@flight-planner/shared'

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

function ContextMenuInner({ airspaces }: { airspaces: Airspace[] }) {
  const setContextMenu = useUiStore(s => s.setContextMenu)

  useMapEvents({
    contextmenu: (e) => {
      e.originalEvent.preventDefault()
      const { lat, lng: lon } = e.latlng
      const matched = airspaces
        .filter(a => a.lowerLimitFt <= 10000 && pointInPolygon(lat, lon, a.boundary.coordinates[0]))
        .sort((a, b) => a.lowerLimitFt - b.lowerLimitFt)
      setContextMenu({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        lat,
        lon,
        airspaces: matched,
      })
    },
    click: () => setContextMenu(null),
  })
  return null
}

function ContextMenuOverlay() {
  const contextMenu = useUiStore(s => s.contextMenuPos)
  const setContextMenu = useUiStore(s => s.setContextMenu)
  const { legId } = useSelectionStore()
  const { getLeg, updateLegWaypoints } = useTripStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [elevationFt, setElevationFt] = useState<number | null>(null)
  const [elevLoading, setElevLoading] = useState(false)

  useEffect(() => {
    if (!contextMenu) return
    setElevationFt(null)
    setElevLoading(true)
    fetch(`https://api.opentopodata.org/v1/srtm90m?locations=${contextMenu.lat},${contextMenu.lon}`)
      .then(r => r.json())
      .then(d => {
        const meters = d.results?.[0]?.elevation
        setElevationFt(meters != null ? Math.round(meters * 3.28084) : null)
      })
      .catch(() => setElevationFt(null))
      .finally(() => setElevLoading(false))
  }, [contextMenu?.lat, contextMenu?.lon])

  if (!contextMenu) return null

  const activeLeg = legId ? getLeg(legId) : null

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${contextMenu.lat.toFixed(6)}, ${contextMenu.lon.toFixed(6)}`)
    setContextMenu(null)
  }

  const handleAddToLeg = async () => {
    if (!activeLeg || !legId) return
    setContextMenu(null)
    try {
      const wp = await api.createWaypoint({
        name: `${contextMenu.lat.toFixed(4)}, ${contextMenu.lon.toFixed(4)}`,
        lat: contextMenu.lat,
        lon: contextMenu.lon,
        waypointType: 'coordinate',
      })
      const allWps = [activeLeg.departure, ...activeLeg.intermediates, activeLeg.arrival]
      const newIntermediates = insertAtOptimalPosition(allWps, wp.id, contextMenu.lat, contextMenu.lon)
      await updateLegWaypoints(legId, activeLeg.departure.id, activeLeg.arrival.id, newIntermediates)
    } catch (e) {
      console.error(e)
    }
  }

  const handleRemoveWaypoint = async () => {
    const wCtx = contextMenu?.waypointCtx
    if (!wCtx) return
    setContextMenu(null)
    const leg = getLeg(wCtx.legId)
    if (!leg) return
    const { waypointIndex: i } = wCtx
    // shift departure forward or arrival backward to the nearest intermediate
    if (i === 0) {
      const newDep = leg.intermediates[0]
      if (!newDep) return
      await updateLegWaypoints(wCtx.legId, newDep.id, leg.arrival.id, leg.intermediates.slice(1).map(w => w.id))
    } else if (i === wCtx.totalWaypoints - 1) {
      const newArr = leg.intermediates[leg.intermediates.length - 1]
      if (!newArr) return
      await updateLegWaypoints(wCtx.legId, leg.departure.id, newArr.id, leg.intermediates.slice(0, -1).map(w => w.id))
    } else {
      // intermediate: index in intermediates array is i - 1
      const newIntermediates = leg.intermediates.filter((_, idx) => idx !== i - 1).map(w => w.id)
      await updateLegWaypoints(wCtx.legId, leg.departure.id, leg.arrival.id, newIntermediates)
    }
  }

  const handleCreateWaypoint = async () => {
    setContextMenu(null)
    try {
      await api.createWaypoint({
        name: `${contextMenu.lat.toFixed(4)}, ${contextMenu.lon.toFixed(4)}`,
        lat: contextMenu.lat,
        lon: contextMenu.lon,
        waypointType: 'coordinate',
      })
    } catch (e) {
      console.error(e)
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999 }}
      className="bg-fp-panel border border-fp-border rounded shadow-lg py-1 min-w-52 max-w-72"
    >
      <div className="px-3 py-1.5 text-xs text-fp-muted border-b border-fp-border">
        <div className="font-mono">{contextMenu.lat.toFixed(5)}, {contextMenu.lon.toFixed(5)}</div>
        <div className="mt-0.5 text-fp-muted-2">
          Elevation:{' '}
          {elevLoading
            ? <span className="opacity-50">…</span>
            : elevationFt != null
              ? <span className="text-fp-text font-medium">{elevationFt.toLocaleString()} ft MSL</span>
              : <span className="opacity-40">unavailable</span>
          }
        </div>
      </div>

      {contextMenu.waypointCtx && (
        <button onClick={handleRemoveWaypoint}
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-fp-border text-red-400">
          Remove from route
        </button>
      )}

      <button onClick={handleCopyCoords}
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-fp-border">
        Copy coordinates
      </button>
      {activeLeg && (
        <button onClick={handleAddToLeg}
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-fp-border">
          Add to "{activeLeg.name || `${activeLeg.departure?.name} → ${activeLeg.arrival?.name}`}"
        </button>
      )}
      <button onClick={handleCreateWaypoint}
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-fp-border text-fp-muted">
        Save as custom waypoint
      </button>

      {contextMenu.airspaces.length > 0 && (
        <>
          <div className="border-t border-fp-border mt-1 px-3 pt-1.5 pb-0.5 text-xs text-fp-muted uppercase tracking-wide">
            Airspace
          </div>
          <ul className="px-3 pb-2 space-y-1.5">
            {contextMenu.airspaces.map(a => (
              <li key={a.id} className="flex items-start gap-1.5 text-xs">
                <span className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${airspaceClassColor(a.airspaceClass)}`} />
                <span className="font-mono font-bold flex-shrink-0">{a.airspaceClass}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-fp-text">{a.name}</span>
                  <span className="text-fp-muted text-[10px]">
                    {formatAlt(a.lowerLimitFt, a.lowerLimitRef)} – {formatAlt(a.upperLimitFt, a.upperLimitRef)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>,
    document.body
  )
}

export default function MapContextMenu() {
  const { data: airspaces = [] } = useAirspaces()
  return (
    <>
      <ContextMenuInner airspaces={airspaces} />
      <ContextMenuOverlay />
    </>
  )
}
