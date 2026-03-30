import { useState, useRef, useEffect } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useUiStore } from '../../store/uiStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useAirplaneStore } from '../../store/airplaneStore'
import { LEG_COLORS } from '../../utils/colorPalette'
import ShareTripModal from '../modals/ShareTripModal'

type EditingNameEntry = {
  id: string
  type: 'trip' | 'flight' | 'leg'
  tripId?: string
  flightId?: string
  value: string
}
type EditingName = EditingNameEntry | null

export default function LeftSidebar() {
  const trips = useTripStore(s => s.trips)
  const {
    deleteTrip, deleteFlight, deleteLeg,
    toggleFlightVisibility, toggleTripVisibility, toggleLegVisibility,
    updateLegWaypoints, updateLeg, updateFlight, updateTrip,
  } = useTripStore()
  const { setCreateFlightOpen, setCreateLegOpen, setActiveFlightId, setActiveTripId } = useUiStore()
  const { selectLeg, clearSelection, legId: selectedLegId } = useSelectionStore()
  const airplanes = useAirplaneStore(s => s.airplanes)

  const [editingLegColor, setEditingLegColor] = useState<string | null>(null)
  const [editingAirplane, setEditingAirplane] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<EditingName>(null)
  const [sharingTripId, setSharingTripId] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [editingName?.id])

  function startRename(e: React.MouseEvent, id: string, type: EditingNameEntry['type'], value: string, tripId?: string, flightId?: string) {
    e.stopPropagation()
    setEditingName({ id, type, value, tripId, flightId })
  }

  function commitRename() {
    if (!editingName) return
    const trimmed = editingName.value.trim()
    if (trimmed) {
      if (editingName.type === 'trip' && editingName.tripId) {
        updateTrip(editingName.tripId, { name: trimmed })
      } else if (editingName.type === 'flight' && editingName.tripId && editingName.flightId) {
        updateFlight(editingName.tripId, editingName.flightId, { name: trimmed })
      } else if (editingName.type === 'leg' && editingName.flightId) {
        updateLeg(editingName.flightId, editingName.id, { name: trimmed })
      }
    }
    setEditingName(null)
  }

  function handleRenameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setEditingName(null)
  }

  return (
    <div className="w-full h-full bg-fp-panel border-r border-fp-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex items-center border-b border-fp-border bg-fp-bg">
        <span className="text-xs font-semibold text-fp-muted-2 uppercase tracking-widest">Trips</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {trips.length === 0 && (
          <div className="p-4 text-fp-muted text-xs leading-relaxed">
            No trips yet.<br />
            Click <span className="text-fp-accent">+ New Trip</span> to start.
          </div>
        )}

        {trips.map(trip => {
          const allVisible = trip.flights.length === 0 || trip.flights.every(f => f.visibleOnMap)
          const someVisible = trip.flights.some(f => f.visibleOnMap)
          const isRenamingTrip = editingName?.type === 'trip' && editingName.id === trip.id

          return (
            <div key={trip.id}>
              {/* Trip row */}
              <div className="px-2 py-2 text-sm font-semibold text-fp-text border-b border-fp-border flex items-center gap-1.5 group bg-fp-panel hover:bg-fp-panel-2 transition-colors">
                {/* Visibility toggle dot */}
                <button
                  onClick={() => toggleTripVisibility(trip.id)}
                  className="flex-shrink-0 w-3 h-3 rounded-full border transition-all"
                  style={{
                    background: allVisible ? '#3b82f6' : someVisible ? 'rgba(59,130,246,0.4)' : 'transparent',
                    borderColor: allVisible || someVisible ? '#3b82f6' : '#64748b',
                  }}
                  title={allVisible ? 'Hide trip' : 'Show trip'}
                />

                {/* Name / inline edit */}
                {isRenamingTrip ? (
                  <input
                    ref={nameInputRef}
                    value={editingName.value}
                    onChange={e => setEditingName(prev => prev ? { ...prev, value: e.target.value } : null)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKey}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-fp-bg border border-fp-accent rounded px-1.5 py-0.5 text-xs text-fp-text focus:outline-none min-w-0"
                  />
                ) : (
                  <span
                    className="flex-1 truncate cursor-default"
                    onDoubleClick={e => startRename(e, trip.id, 'trip', trip.name, trip.id)}
                    title="Double-click to rename"
                  >
                    {trip.name}
                  </span>
                )}

                {/* Pencil hint on hover */}
                {!isRenamingTrip && (
                  <span
                    className="text-fp-muted opacity-0 group-hover:opacity-60 text-xs cursor-pointer hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={e => startRename(e, trip.id, 'trip', trip.name, trip.id)}
                    title="Rename trip"
                  >✎</span>
                )}

                <button
                  onClick={e => { e.stopPropagation(); setSharingTripId(trip.id) }}
                  className="text-fp-muted hover:text-fp-accent-2 opacity-0 group-hover:opacity-80 text-xs flex-shrink-0 transition-colors"
                  title="Share trip"
                >⇄</button>
                <button
                  onClick={() => { setActiveTripId(trip.id); setActiveFlightId(null); setCreateFlightOpen(true) }}
                  className="text-fp-muted hover:text-fp-accent text-xs flex-shrink-0 transition-colors"
                  title="Add flight"
                >+ Flight</button>
                <button
                  onClick={() => deleteTrip(trip.id)}
                  className="text-fp-muted hover:text-fp-danger opacity-0 group-hover:opacity-100 text-sm leading-none flex-shrink-0 transition-colors"
                  title="Delete trip"
                >×</button>
              </div>

              {/* Flights */}
              {trip.flights.map(flight => {
                const isRenamingFlight = editingName?.type === 'flight' && editingName.id === flight.id
                return (
                  <div key={flight.id}>
                    {/* Flight row */}
                    <div className="pl-5 pr-2 py-1.5 flex items-center gap-1.5 text-xs text-fp-muted-2 hover:bg-fp-panel-2 group border-b border-fp-border/50 transition-colors">
                      <button
                        onClick={() => toggleFlightVisibility(trip.id, flight.id)}
                        className="flex-shrink-0 w-2.5 h-2.5 rounded-full border transition-all"
                        style={{
                          background: flight.visibleOnMap ? '#3b82f6' : 'transparent',
                          borderColor: flight.visibleOnMap ? '#3b82f6' : '#64748b',
                        }}
                        title={flight.visibleOnMap ? 'Hide on map' : 'Show on map'}
                      />

                      {isRenamingFlight ? (
                        <input
                          ref={nameInputRef}
                          value={editingName.value}
                          onChange={e => setEditingName(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onBlur={commitRename}
                          onKeyDown={handleRenameKey}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 bg-fp-bg border border-fp-accent rounded px-1.5 py-0.5 text-xs text-fp-text focus:outline-none min-w-0"
                        />
                      ) : (
                        <span
                          className="flex-1 truncate font-medium text-fp-text cursor-default"
                          onDoubleClick={e => startRename(e, flight.id, 'flight', flight.name, trip.id, flight.id)}
                          title="Double-click to rename"
                        >
                          {flight.name}
                        </span>
                      )}

                      {!isRenamingFlight && (
                        <span
                          className="text-fp-muted opacity-0 group-hover:opacity-60 text-xs cursor-pointer hover:opacity-100 transition-opacity flex-shrink-0"
                          onClick={e => startRename(e, flight.id, 'flight', flight.name, trip.id, flight.id)}
                          title="Rename flight"
                        >✎</span>
                      )}

                      <button
                        onClick={() => setEditingAirplane(editingAirplane === flight.id ? null : flight.id)}
                        className="hover:text-fp-accent-2 flex-shrink-0 transition-colors"
                        title="Change airplane"
                      >✈</button>
                      <button
                        onClick={() => { setActiveFlightId(flight.id); setCreateLegOpen(true) }}
                        className="hover:text-fp-accent flex-shrink-0 transition-colors"
                        title="Add leg"
                      >+</button>
                      <button
                        onClick={() => deleteFlight(trip.id, flight.id)}
                        className="hover:text-fp-danger opacity-0 group-hover:opacity-100 text-sm leading-none flex-shrink-0 transition-colors"
                        title="Delete flight"
                      >×</button>
                    </div>

                    {/* Airplane selector */}
                    {editingAirplane === flight.id && (
                      <div className="pl-5 pr-2 pb-2 pt-1 bg-fp-bg border-b border-fp-border">
                        <select
                          autoFocus
                          value={flight.airplaneId || ''}
                          onChange={e => { updateFlight(trip.id, flight.id, { airplaneId: e.target.value || undefined }); setEditingAirplane(null) }}
                          onBlur={() => setEditingAirplane(null)}
                          className="w-full bg-fp-panel-2 border border-fp-border-2 rounded px-2 py-1 text-xs text-fp-text focus:outline-none focus:border-fp-accent"
                        >
                          <option value="">No airplane</option>
                          {airplanes.map(a => (
                            <option key={a.id} value={a.id}>{a.name}{a.registration ? ` (${a.registration})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Legs */}
                    {flight.legs.map(leg => {
                      const isRenamingLeg = editingName?.type === 'leg' && editingName.id === leg.id
                      return (
                        <div key={leg.id}>
                          {/* Leg row with colored left border */}
                          <div
                            onClick={() => selectedLegId === leg.id ? clearSelection() : selectLeg(leg.id, flight.id)}
                            className={`pl-5 pr-2 py-1.5 flex items-center gap-2 cursor-pointer text-xs hover:bg-fp-panel-2 group border-b border-fp-border/30 transition-colors ${selectedLegId === leg.id ? 'bg-fp-panel-2' : ''} ${leg.visible === false ? 'opacity-40' : ''}`}
                          >
                            {/* Colored left accent bar */}
                            <div
                              className="w-0.5 self-stretch flex-shrink-0 rounded-r"
                              style={{ background: leg.color, minHeight: '20px' }}
                            />

                            {/* Color dot */}
                            <button
                              onClick={e => { e.stopPropagation(); setEditingLegColor(editingLegColor === leg.id ? null : leg.id) }}
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 hover:ring-2 hover:ring-white/40 cursor-pointer transition-all"
                              style={{ background: leg.color }}
                              title="Change color"
                            />

                            {/* Name / inline edit */}
                            {isRenamingLeg ? (
                              <input
                                ref={nameInputRef}
                                value={editingName.value}
                                onChange={e => setEditingName(prev => prev ? { ...prev, value: e.target.value } : null)}
                                onBlur={commitRename}
                                onKeyDown={handleRenameKey}
                                onClick={e => e.stopPropagation()}
                                className="flex-1 bg-fp-bg border border-fp-accent rounded px-1.5 py-0.5 text-xs text-fp-text focus:outline-none min-w-0"
                              />
                            ) : (
                              <span
                                className={`flex-1 truncate text-fp-muted-2 cursor-default ${leg.visible === false ? 'line-through' : ''}`}
                                onDoubleClick={e => {
                                  e.stopPropagation()
                                  startRename(e, leg.id, 'leg', leg.name || `${leg.departure?.name} → ${leg.arrival?.name}`, trip.id, flight.id)
                                }}
                                title="Double-click to rename"
                              >
                                {leg.name || `${leg.departure?.name} → ${leg.arrival?.name}`}
                              </span>
                            )}

                            {!isRenamingLeg && (
                              <span
                                className="text-fp-muted opacity-0 group-hover:opacity-60 text-xs cursor-pointer hover:opacity-100 transition-opacity flex-shrink-0"
                                onClick={e => { e.stopPropagation(); startRename(e, leg.id, 'leg', leg.name || `${leg.departure?.name} → ${leg.arrival?.name}`, trip.id, flight.id) }}
                                title="Rename leg"
                              >✎</span>
                            )}

                            <button
                              onClick={e => { e.stopPropagation(); toggleLegVisibility(flight.id, leg.id) }}
                              className="text-fp-muted hover:text-fp-text opacity-0 group-hover:opacity-100 flex-shrink-0 transition-colors"
                              title={leg.visible === false ? 'Show on map' : 'Hide from map'}
                            >{leg.visible === false ? '○' : '●'}</button>
                            <button
                              onClick={e => { e.stopPropagation(); deleteLeg(flight.id, leg.id) }}
                              className="text-fp-muted hover:text-fp-danger opacity-0 group-hover:opacity-100 text-sm leading-none flex-shrink-0 transition-colors"
                              title="Delete leg"
                            >×</button>
                          </div>

                          {/* Color picker */}
                          {editingLegColor === leg.id && (
                            <div className="pl-4 pr-2 pb-2 pt-1 flex items-center gap-1.5 flex-wrap bg-fp-bg border-b border-fp-border" onClick={e => e.stopPropagation()}>
                              {LEG_COLORS.map(c => (
                                <button
                                  key={c}
                                  onClick={() => { updateLeg(flight.id, leg.id, { color: c }); setEditingLegColor(null) }}
                                  className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${leg.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                                  style={{ background: c }}
                                />
                              ))}
                              <input
                                type="color"
                                value={leg.color}
                                onChange={e => updateLeg(flight.id, leg.id, { color: e.target.value })}
                                onBlur={() => setEditingLegColor(null)}
                                className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                                title="Custom color"
                              />
                            </div>
                          )}

                          {/* Selected leg waypoints */}
                          {selectedLegId === leg.id && (
                            <div className="pb-1 bg-fp-bg border-b border-fp-border/50">
                              {leg.departure && (
                                <div className="pl-8 pr-2 py-0.5 flex items-center gap-2 text-xs text-fp-muted">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-fp-success" />
                                  <span className="truncate font-mono text-fp-muted-2">{leg.departure.icaoCode || leg.departure.name}</span>
                                </div>
                              )}
                              {leg.intermediates?.map((wp, idx) => (
                                <div key={wp.id} className="pl-8 pr-2 py-0.5 flex items-center gap-2 text-xs text-fp-muted group/wp">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-fp-muted" />
                                  <span className="flex-1 truncate font-mono">{wp.icaoCode || wp.name}</span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      const remaining = leg.intermediates.filter((_, i) => i !== idx)
                                      updateLegWaypoints(leg.id, leg.departure.id, leg.arrival.id, remaining.map(i => i.id)).catch(console.error)
                                    }}
                                    className="text-fp-muted hover:text-fp-danger opacity-0 group-hover/wp:opacity-100 flex-shrink-0 transition-colors"
                                  >×</button>
                                </div>
                              ))}
                              {leg.arrival && (
                                <div className="pl-6 pr-2 py-0.5 flex items-center gap-2 text-xs text-fp-muted">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-fp-danger" />
                                  <span className="truncate font-mono text-fp-muted-2">{leg.arrival.icaoCode || leg.arrival.name}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {sharingTripId && (() => {
        const trip = trips.find(t => t.id === sharingTripId)
        return trip ? (
          <ShareTripModal
            tripId={sharingTripId}
            tripName={trip.name}
            onClose={() => setSharingTripId(null)}
          />
        ) : null
      })()}
    </div>
  )
}
