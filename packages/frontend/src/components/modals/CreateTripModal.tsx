import { useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useUiStore } from '../../store/uiStore'

export default function CreateTripModal() {
  const isOpen = useUiStore(s => s.createTripOpen)
  const setOpen = useUiStore(s => s.setCreateTripOpen)
  const createTrip = useTripStore(s => s.createTrip)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!name.trim()) return
    await createTrip(name.trim(), description.trim() || undefined)
    setName('')
    setDescription('')
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setOpen(false)}>
      <div className="bg-fp-panel border border-fp-border rounded-lg p-6 w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Trip</h2>
        <div className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm focus:outline-none focus:border-fp-accent"
            placeholder="Trip name"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-fp-bg border border-fp-border rounded px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:border-fp-accent"
            placeholder="Description (optional)"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-fp-muted hover:text-fp-text">Cancel</button>
          <button onClick={handleCreate} className="px-4 py-2 bg-fp-accent text-white rounded text-sm hover:bg-blue-500">Create</button>
        </div>
      </div>
    </div>
  )
}
