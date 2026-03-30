import { useSelectionStore } from '../../store/selectionStore'
import { useTripStore } from '../../store/tripStore'
import { useAirplaneStore } from '../../store/airplaneStore'
import { calculateLegStats, formatEte } from '../../utils/legCalc'

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-fp-muted">{label}</span>
      <span className="bg-fp-panel-2 px-2 py-0.5 rounded text-fp-text font-medium border border-fp-border">{value}</span>
    </span>
  )
}

function Sep() {
  return <span className="text-fp-border-2 text-xs">|</span>
}

export default function BottomStrip() {
  const { legId, flightId } = useSelectionStore()
  const getLeg = useTripStore(s => s.getLeg)
  const getFlight = useTripStore(s => s.getFlight)
  const airplanes = useAirplaneStore(s => s.airplanes)

  if (!legId) {
    return (
      <div className="h-10 bg-fp-panel border-t border-fp-border flex items-center px-4 text-xs text-fp-muted gap-2">
        <span className="w-2 h-2 rounded-full bg-fp-muted/30 flex-shrink-0" />
        Select a leg to see stats
      </div>
    )
  }

  const leg = getLeg(legId)
  const flight = flightId ? getFlight(flightId) : null
  const airplane = flight?.airplaneId ? airplanes.find(a => a.id === flight.airplaneId) : null

  if (!leg) return null

  const stats = calculateLegStats(leg, airplane)

  return (
    <div className="h-10 bg-fp-panel border-t border-fp-border-2 flex items-center px-4 gap-3 text-xs overflow-x-auto">
      {/* Leg color indicator */}
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: leg.color, boxShadow: `0 0 6px ${leg.color}88` }}
      />

      {/* Route */}
      <span className="font-semibold text-fp-text flex items-center gap-1 flex-shrink-0">
        <span className="font-mono text-sm">{leg.departure?.icaoCode || leg.departure?.name}</span>
        <span className="text-fp-muted mx-0.5">→</span>
        <span className="font-mono text-sm">{leg.arrival?.icaoCode || leg.arrival?.name}</span>
      </span>

      <Sep />

      <StatBadge label="Dist" value={`${stats.distanceNm} NM`} />

      {airplane && (
        <>
          <Sep />
          <StatBadge label="ETE" value={formatEte(stats.eteMinutes)} />
          <Sep />
          <StatBadge label="Fuel" value={`${stats.fuelBurn} ${stats.fuelUnit}`} />
        </>
      )}
    </div>
  )
}
