import { useState, useEffect } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useUiStore } from '../../store/uiStore'
import { useAirplaneStore } from '../../store/airplaneStore'

export default function CreateFlightModal() {
  const isOpen = useUiStore(s => s.createFlightOpen)
  const setOpen = useUiStore(s => s.setCreateFlightOpen)
  const activeTripId = useUiStore(s => s.activeTripId)
  const trips = useTripStore(s => s.trips)
  const createFlight = useTripStore(s => s.createFlight)
  const airplanes = useAirplaneStore(s => s.airplanes)
  const [name, setName] = useState('')
  const [tripId, setTripId] = useState('')
  const [airplaneId, setAirplaneId] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (activeTripId) setTripId(activeTripId)
    } else {
      setName('')
      setTripId('')
      setAirplaneId('')
    }
  }, [isOpen, activeTripId])

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!name.trim() || !tripId) return
    await createFlight(tripId, name.trim(), airplaneId || undefined)
    setName('')
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setOpen(false)}>
      <div className="bg-fp-panel border border-fp-border rounded-lg p-6 w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Flight</h2>
        <div className="space-y-3">
          <select value={tripId} onChange={e => setTripId(e.target.value)} className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm focus:outline-none focus:border-fp-accent">
            <option value="">Select trip...</option>
            {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm focus:outline-none focus:border-fp-accent"
            placeholder="Flight name"
          />
          <select value={airplaneId} onChange={e => setAirplaneId(e.target.value)} className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm focus:outline-none focus:border-fp-accent">
            <option value="">No airplane (no fuel/time calc)</option>
            {airplanes.map(a => <option key={a.id} value={a.id}>{a.name} {a.registration ? `(${a.registration})` : ''}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-fp-muted hover:text-fp-text">Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim() || !tripId} className="px-4 py-2 bg-fp-accent text-white rounded text-sm hover:bg-blue-500 disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  )
}
