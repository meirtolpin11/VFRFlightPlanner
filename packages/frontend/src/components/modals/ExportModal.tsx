import { useUiStore } from '../../store/uiStore'
import { useTripStore } from '../../store/tripStore'

export default function ExportModal() {
  const { exportOpen, exportLegId, closeExport } = useUiStore()
  const getLeg = useTripStore(s => s.getLeg)

  if (!exportOpen || !exportLegId) return null
  const leg = getLeg(exportLegId)

  const download = (format: 'gpx' | 'pln' | 'fpl') => {
    window.open(`/api/v1/legs/${exportLegId}/export/${format}`, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={closeExport}>
      <div className="bg-fp-panel border border-fp-border rounded-lg p-6 w-80" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1">Export Leg</h2>
        {leg && <p className="text-fp-muted text-sm mb-4">{leg.name || `${leg.departure?.name} → ${leg.arrival?.name}`}</p>}
        <div className="space-y-2">
          <button onClick={() => download('gpx')} className="w-full flex items-center gap-3 p-3 bg-fp-bg border border-fp-border rounded hover:border-fp-accent text-sm">
            <span className="font-medium">GPX</span>
            <span className="text-fp-muted text-xs">GPS Exchange — works with most devices</span>
          </button>
          <button onClick={() => download('pln')} className="w-full flex items-center gap-3 p-3 bg-fp-bg border border-fp-border rounded hover:border-fp-accent text-sm">
            <span className="font-medium">PLN</span>
            <span className="text-fp-muted text-xs">MSFS / FSX flight plan format</span>
          </button>
          <button onClick={() => download('fpl')} className="w-full flex items-center gap-3 p-3 bg-fp-bg border border-fp-border rounded hover:border-fp-accent text-sm">
            <span className="font-medium">FPL</span>
            <span className="text-fp-muted text-xs">Garmin avionics format</span>
          </button>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={closeExport} className="px-4 py-2 text-sm text-fp-muted hover:text-fp-text">Close</button>
        </div>
      </div>
    </div>
  )
}
