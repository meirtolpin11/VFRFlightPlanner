import { create } from 'zustand'
import type { Airport } from '@flight-planner/shared'

type SelectionType = 'leg' | 'airport' | 'waypoint' | null

interface SelectionStore {
  type: SelectionType
  legId: string | null
  flightId: string | null
  airport: Airport | null
  waypointId: string | null

  selectLeg: (legId: string, flightId: string) => void
  selectAirport: (airport: Airport) => void
  selectWaypoint: (waypointId: string) => void
  clearSelection: () => void
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  type: null,
  legId: null,
  flightId: null,
  airport: null,
  waypointId: null,

  selectLeg: (legId, flightId) => set({ type: 'leg', legId, flightId, airport: null }),
  selectAirport: (airport) => set(state => ({ type: 'airport', airport, legId: state.legId, flightId: state.flightId })),
  selectWaypoint: (waypointId) => set({ type: 'waypoint', waypointId, airport: null }),
  clearSelection: () => set({ type: null, legId: null, airport: null, waypointId: null }),
}))
