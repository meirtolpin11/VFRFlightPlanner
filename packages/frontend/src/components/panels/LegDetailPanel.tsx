import { useEffect, useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useUiStore } from '../../store/uiStore'
import LegChatThread from './LegChatThread'
import { LEG_COLORS } from '../../utils/colorPalette'

interface Props {
  legId: string
  flightId: string
}

export default function LegDetailPanel({ legId, flightId }: Props) {
  const getLeg = useTripStore(s => s.getLeg)
  const updateLeg = useTripStore(s => s.updateLeg)
  const openExport = useUiStore(s => s.openExport)
  const leg = getLeg(legId)
  const [notes, setNotes] = useState(leg?.notes || '')
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  useEffect(() => {
    if (leg) setNotes(leg.notes || '')
  }, [legId])

  if (!leg) return <div className="p-3 text-fp-muted text-sm">Leg not found</div>

  const handleNotesChange = (v: string) => {
    setNotes(v)
    if (saveTimer) clearTimeout(saveTimer)
    setSaveTimer(setTimeout(() => updateLeg(flightId, legId, { notes: v }), 800))
  }

  const waypoints = [leg.departure, ...leg.intermediates, leg.arrival]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-2 border-b border-fp-border flex items-center gap-2">
        <button
          onClick={() => setColorPickerOpen(v => !v)}
          className="w-3 h-3 rounded-full flex-shrink-0 hover:ring-2 hover:ring-white/50"
          style={{ background: leg.color }}
          title="Change color"
        />
        <span className="font-semibold text-sm truncate flex-1">{leg.name || `${leg.departure?.name} → ${leg.arrival?.name}`}</span>
        <button onClick={() => openExport(legId)} className="text-xs text-fp-accent hover:underline">Export</button>
      </div>
      {colorPickerOpen && (
        <div className="px-2 py-1.5 border-b border-fp-border flex items-center gap-1.5 flex-wrap">
          {LEG_COLORS.map(c => (
            <button
              key={c}
              onClick={() => { updateLeg(flightId, legId, { color: c }); setColorPickerOpen(false) }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${leg.color === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}
          <input
            type="color"
            value={leg.color}
            onChange={e => updateLeg(flightId, legId, { color: e.target.value })}
            onBlur={() => setColorPickerOpen(false)}
            className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
            title="Custom color"
          />
        </div>
      )}

      <div className="p-2 border-b border-fp-border">
        <div className="text-xs text-fp-muted mb-1">Waypoints</div>
        {waypoints.map((wp, i) => (
          <div key={wp.id} className="flex items-center gap-2 py-0.5 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
              background: i === 0 ? '#22c55e' : i === waypoints.length - 1 ? '#ef4444' : '#f59e0b'
            }} />
            <span className="flex-1 truncate">{wp.name}</span>
            {wp.icaoCode && <span className="text-fp-muted">{wp.icaoCode}</span>}
          </div>
        ))}
      </div>

      <div className="p-2 border-b border-fp-border">
        <div className="text-xs text-fp-muted mb-1">Notes</div>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          className="w-full bg-fp-bg border border-fp-border rounded p-1.5 text-xs text-fp-text resize-none h-20 focus:outline-none focus:border-fp-accent"
          placeholder="Add notes for this leg..."
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <LegChatThread legId={legId} />
      </div>
    </div>
  )
}
