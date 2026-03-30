import { useState } from 'react'
import { useMap } from 'react-leaflet'
import { useUiStore, type PendingLegPoint } from '../../store/uiStore'
import { useTripStore } from '../../store/tripStore'
import { useSelectionStore } from '../../store/selectionStore'
import { nextLegColor } from '../../utils/colorPalette'

interface Props {
  point: PendingLegPoint
}

export default function PointActions({ point }: Props) {
  const map = useMap()
  const pendingLeg = useUiStore(s => s.pendingLeg)
  const activeFlightId = useUiStore(s => s.activeFlightId)
  const { startPendingLeg, addPendingLegIntermediate, clearPendingLeg } = useUiStore()
  const { trips, createLeg, updateLegWaypoints, getLeg } = useTripStore()
  const { legId, selectLeg } = useSelectionStore()
  const [busy, setBusy] = useState(false)
  const [selectedFlight, setSelectedFlight] = useState(activeFlightId || '')

  const allFlights = trips.flatMap(t => t.flights.map(f => ({ ...f, tripName: t.name })))
  const activeLeg = legId ? getLeg(legId) : null
  const isDeparture = pendingLeg?.departure.id === point.id
  const label = point.icaoCode || point.name

  // ── Mode A: building a leg and this IS the departure ──────────────────────
  if (pendingLeg && isDeparture) {
    const stops = [pendingLeg.departure, ...pendingLeg.intermediates].map(p => p.icaoCode || p.name).join(' → ')
    return (
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-gray-500 italic">Building: {stops} → ?</div>
        <button
          onClick={() => { clearPendingLeg(); map.closePopup() }}
          className="w-full text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
        >
          ✕ Cancel leg creation
        </button>
      </div>
    )
  }

  // ── Mode B: building a leg and this is the arrival ─────────────────────────
  if (pendingLeg && !isDeparture) {
    const depLabel = pendingLeg.departure.icaoCode || pendingLeg.departure.name
    const flightId = selectedFlight || activeFlightId || (allFlights.length === 1 ? allFlights[0].id : '')

    const handleComplete = async () => {
      if (!flightId) return
      setBusy(true)
      try {
        const [depWp, ...intAndArr] = await Promise.all([
          pendingLeg.departure.getWaypoint(),
          ...pendingLeg.intermediates.map(i => i.getWaypoint()),
          point.getWaypoint(),
        ])
        const intWps = intAndArr.slice(0, intAndArr.length - 1)
        const arrWp = intAndArr[intAndArr.length - 1]
        const flight = allFlights.find(f => f.id === flightId)
        const color = nextLegColor(flight?.legs.map(l => l.color) || [])
        const leg = await createLeg(flightId, { departureId: depWp.id, arrivalId: arrWp.id, color })
        if (intWps.length > 0) {
          await updateLegWaypoints(leg.id, depWp.id, arrWp.id, intWps.map(w => w.id))
        }
        selectLeg(leg.id, flightId)
        clearPendingLeg()
        map.closePopup()
      } catch (e) { console.error(e) }
      finally { setBusy(false) }
    }

    return (
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-blue-600 font-medium">
          Leg from {depLabel}{pendingLeg.intermediates.length > 0 ? ` (+${pendingLeg.intermediates.length} stops)` : ''}
        </div>
        {allFlights.length === 0 ? (
          <div className="text-xs text-gray-400 italic">No flights yet — create a flight first</div>
        ) : (
          <>
            {allFlights.length > 1 && (
              <select
                value={selectedFlight}
                onChange={e => setSelectedFlight(e.target.value)}
                className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
              >
                <option value="">Select flight…</option>
                {allFlights.map(f => <option key={f.id} value={f.id}>{f.tripName} / {f.name}</option>)}
              </select>
            )}
            <button
              disabled={busy || !flightId}
              onClick={handleComplete}
              className="w-full text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              ✈ Complete leg to {label}
            </button>
          </>
        )}
        <button
          onClick={() => { addPendingLegIntermediate(point); map.closePopup() }}
          className="w-full text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
        >
          + Add as intermediate stop
        </button>
        <button
          onClick={() => { clearPendingLeg(); map.closePopup() }}
          className="w-full text-xs px-2 py-0.5 text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    )
  }

  // ── Mode C: no pending leg ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={() => { startPendingLeg(point); map.closePopup() }}
        className="w-full text-xs px-2 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
      >
        ✈ Start leg from {label}
      </button>
      {activeLeg && (
        <>
          <div className="text-xs text-gray-400 pt-0.5 border-t border-gray-100">Modify active leg:</div>
          <button disabled={busy} onClick={async () => {
            setBusy(true)
            try { const wp = await point.getWaypoint(); await updateLegWaypoints(activeLeg.id, wp.id, activeLeg.arrival.id, activeLeg.intermediates.map(i => i.id)); map.closePopup() } finally { setBusy(false) }
          }} className="w-full text-xs px-2 py-1 rounded bg-green-50 text-green-800 border border-green-200 hover:bg-green-100 disabled:opacity-50">Set as departure</button>
          <button disabled={busy} onClick={async () => {
            setBusy(true)
            try { const wp = await point.getWaypoint(); await updateLegWaypoints(activeLeg.id, activeLeg.departure.id, wp.id, activeLeg.intermediates.map(i => i.id)); map.closePopup() } finally { setBusy(false) }
          }} className="w-full text-xs px-2 py-1 rounded bg-red-50 text-red-800 border border-red-200 hover:bg-red-100 disabled:opacity-50">Set as arrival</button>
          <button disabled={busy} onClick={async () => {
            setBusy(true)
            try { const wp = await point.getWaypoint(); await updateLegWaypoints(activeLeg.id, activeLeg.departure.id, activeLeg.arrival.id, [...activeLeg.intermediates.map(i => i.id), wp.id]); map.closePopup() } finally { setBusy(false) }
          }} className="w-full text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50">+ Add as intermediate</button>
        </>
      )}
    </div>
  )
}
