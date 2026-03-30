import { useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useAirplaneStore } from '../../store/airplaneStore'

export default function AirplaneProfilesModal() {
  const isOpen = useUiStore(s => s.airplanesOpen)
  const setOpen = useUiStore(s => s.setAirplanesOpen)
  const { airplanes, createAirplane, deleteAirplane } = useAirplaneStore()
  const [name, setName] = useState('')
  const [reg, setReg] = useState('')
  const [tas, setTas] = useState('')
  const [fuel, setFuel] = useState('')
  const [fuelUnit, setFuelUnit] = useState<'gal' | 'L'>('gal')

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!name || !tas || !fuel) return
    await createAirplane({ name, registration: reg || undefined, cruiseTasKts: Number(tas), fuelConsumption: Number(fuel), fuelUnit })
    setName(''); setReg(''); setTas(''); setFuel('')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setOpen(false)}>
      <div className="bg-fp-panel border border-fp-border rounded-lg p-6 w-[480px]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Airplane Profiles</h2>
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {airplanes.map(a => (
            <div key={a.id} className="flex items-center gap-3 py-1.5 px-2 bg-fp-bg rounded text-sm">
              <span className="flex-1 font-medium">{a.name}</span>
              {a.registration && <span className="text-fp-muted text-xs">{a.registration}</span>}
              <span className="text-fp-muted text-xs">{a.cruiseTasKts} kts</span>
              <span className="text-fp-muted text-xs">{a.fuelConsumption} {a.fuelUnit}/hr</span>
              <button onClick={() => deleteAirplane(a.id)} className="text-fp-muted hover:text-red-400 text-xs">×</button>
            </div>
          ))}
        </div>
        <div className="border-t border-fp-border pt-4">
          <div className="text-sm font-medium mb-2">Add New</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={e => setName(e.target.value)} className="col-span-2 bg-fp-bg border border-fp-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-fp-accent" placeholder="Aircraft name" />
            <input value={reg} onChange={e => setReg(e.target.value)} className="bg-fp-bg border border-fp-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-fp-accent" placeholder="Registration (opt)" />
            <input value={tas} onChange={e => setTas(e.target.value)} type="number" className="bg-fp-bg border border-fp-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-fp-accent" placeholder="Cruise TAS (kts)" />
            <input value={fuel} onChange={e => setFuel(e.target.value)} type="number" step="0.1" className="bg-fp-bg border border-fp-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-fp-accent" placeholder="Fuel/hr" />
            <select value={fuelUnit} onChange={e => setFuelUnit(e.target.value as 'gal' | 'L')} className="bg-fp-bg border border-fp-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-fp-accent">
              <option value="gal">Gallons (gal)</option>
              <option value="L">Liters (L)</option>
            </select>
          </div>
          <button onClick={handleCreate} className="mt-2 px-4 py-1.5 bg-fp-accent text-white rounded text-sm hover:bg-blue-500">Add Airplane</button>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-fp-muted hover:text-fp-text">Close</button>
        </div>
      </div>
    </div>
  )
}
