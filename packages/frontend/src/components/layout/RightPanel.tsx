import { useSelectionStore } from '../../store/selectionStore'
import LegDetailPanel from '../panels/LegDetailPanel'
import AirportDetailPanel from '../panels/AirportDetailPanel'

export default function RightPanel() {
  const { type, legId, flightId, airport } = useSelectionStore()

  if (type === 'leg' && legId && flightId) {
    return (
      <div className="w-full h-full bg-fp-panel border-l border-fp-border flex flex-col overflow-hidden">
        <LegDetailPanel legId={legId} flightId={flightId} />
      </div>
    )
  }

  if (type === 'airport' && airport) {
    return (
      <div className="w-full h-full bg-fp-panel border-l border-fp-border flex flex-col overflow-hidden">
        <AirportDetailPanel airport={airport} />
      </div>
    )
  }

  return (
    <div className="w-72 bg-fp-panel border-l border-fp-border flex flex-col overflow-hidden">
      <div className="p-4 text-fp-muted text-sm">
        Select a leg or click an airport to see details.
      </div>
    </div>
  )
}
