import { useState, useEffect } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useUiStore } from '../../store/uiStore'
import { useSelectionStore } from '../../store/selectionStore'
import { api } from '../../services/api'
import type { Waypoint } from '@flight-planner/shared'
import { nextLegColor, LEG_COLORS } from '../../utils/colorPalette'

export default function CreateLegModal() {
  const isOpen = useUiStore(s => s.createLegOpen)
  const setOpen = useUiStore(s => s.setCreateLegOpen)
  const activeFlightId = useUiStore(s => s.activeFlightId)
  const trips = useTripStore(s => s.trips)
  const createLeg = useTripStore(s => s.createLeg)
  const selectLeg = useSelectionStore(s => s.selectLeg)

  const [flightId, setFlightId] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState(LEG_COLORS[0])
  const [depQuery, setDepQuery] = useState('')
  const [arrQuery, setArrQuery] = useState('')
  const [depResults, setDepResults] = useState<Waypoint[]>([])
  const [arrResults, setArrResults] = useState<Waypoint[]>([])
  const [selectedDep, setSelectedDep] = useState<Waypoint | null>(null)
  const [selectedArr, setSelectedArr] = useState<Waypoint | null>(null)

  useEffect(() => {
    if (activeFlightId) setFlightId(activeFlightId)
  }, [activeFlightId])

  // Update default color when flight changes
  useEffect(() => {
    if (!flightId) return
    const flight = trips.flatMap(t => t.flights).find(f => f.id === flightId)
    const existingColors = flight?.legs.map(l => l.color) || []
    setColor(nextLegColor(existingColors))
  }, [flightId, trips])

  useEffect(() => {
    if (!isOpen) {
      setName(''); setDepQuery(''); setArrQuery('')
      setDepResults([]); setArrResults([])
      setSelectedDep(null); setSelectedArr(null)
    }
  }, [isOpen])

  const searchWaypoints = async (q: string, setter: (r: Waypoint[]) => void) => {
    if (q.length < 2) { setter([]); return }
    try {
      const results = await api.searchWaypoints(q)
      setter(results)
    } catch {}
  }

  useEffect(() => {
    const t = setTimeout(() => searchWaypoints(depQuery, setDepResults), 300)
    return () => clearTimeout(t)
  }, [depQuery])

  useEffect(() => {
    const t = setTimeout(() => searchWaypoints(arrQuery, setArrResults), 300)
    return () => clearTimeout(t)
  }, [arrQuery])

  // Resolve an oaip airport/navaid result to a proper waypoint ID before creating the leg
  const resolveWaypointId = async (w: Waypoint & { oaipId?: string; oaipNavaidId?: string }): Promise<string> => {
    if (w.oaipNavaidId) {
      const created = await api.getOrCreateNavaidWaypoint(w.oaipNavaidId)
      return created.id
    }
    if (w.oaipId) {
      const created = await api.getOrCreateAirportWaypoint(w.oaipId)
      return created.id
    }
    return w.id
  }

  const handleCreate = async () => {
    if (!flightId || !selectedDep || !selectedArr) return
    const [departureId, arrivalId] = await Promise.all([
      resolveWaypointId(selectedDep as Waypoint & { oaipId?: string; oaipNavaidId?: string }),
      resolveWaypointId(selectedArr as Waypoint & { oaipId?: string; oaipNavaidId?: string }),
    ])
    const leg = await createLeg(flightId, {
      departureId,
      arrivalId,
      name: name.trim() || undefined,
      color,
    })
    selectLeg(leg.id, flightId)
    setOpen(false)
  }

  if (!isOpen) return null

  const allFlights = trips.flatMap(t => t.flights.map(f => ({ ...f, tripName: t.name })))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setOpen(false)}>
      <div className="bg-fp-panel border border-fp-border rounded-lg p-6 w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Leg</h2>
        <div className="space-y-3">
          <select value={flightId} onChange={e => setFlightId(e.target.value)} className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm focus:outline-none focus:border-fp-accent">
            <option value="">Select flight...</option>
            {allFlights.map(f => <option key={f.id} value={f.id}>{f.tripName} / {f.name}</option>)}
          </select>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm focus:outline-none focus:border-fp-accent" placeholder="Leg name (optional)" />

          <div className="relative">
            <input value={selectedDep ? selectedDep.name : depQuery} onChange={e => { setSelectedDep(null); setDepQuery(e.target.value) }} className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm focus:outline-none focus:border-fp-accent" placeholder="Departure (ICAO or name)" />
            {depResults.length > 0 && !selectedDep && (
              <div className="absolute z-10 w-full bg-fp-panel border border-fp-border rounded mt-1 max-h-32 overflow-y-auto">
                {depResults.map(w => (
                  <button key={w.id} onClick={() => { setSelectedDep(w); setDepResults([]) }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-fp-border">
                    {w.name} {w.icaoCode && <span className="text-fp-muted">({w.icaoCode})</span>}{(w.waypointType === 'vor' || w.waypointType === 'ndb') && <span className="text-fp-accent ml-1">{w.waypointType.toUpperCase()}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <input value={selectedArr ? selectedArr.name : arrQuery} onChange={e => { setSelectedArr(null); setArrQuery(e.target.value) }} className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm focus:outline-none focus:border-fp-accent" placeholder="Arrival (ICAO or name)" />
            {arrResults.length > 0 && !selectedArr && (
              <div className="absolute z-10 w-full bg-fp-panel border border-fp-border rounded mt-1 max-h-32 overflow-y-auto">
                {arrResults.map(w => (
                  <button key={w.id} onClick={() => { setSelectedArr(w); setArrResults([]) }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-fp-border">
                    {w.name} {w.icaoCode && <span className="text-fp-muted">({w.icaoCode})</span>}{(w.waypointType === 'vor' || w.waypointType === 'ndb') && <span className="text-fp-accent ml-1">{w.waypointType.toUpperCase()}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-fp-muted mb-1.5">Leg color</div>
            <div className="flex items-center gap-2 flex-wrap">
              {LEG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-fp-border bg-transparent"
                title="Custom color"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-fp-muted hover:text-fp-text">Cancel</button>
          <button onClick={handleCreate} disabled={!selectedDep || !selectedArr || !flightId} className="px-4 py-2 bg-fp-accent text-white rounded text-sm hover:bg-blue-500 disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  )
}
