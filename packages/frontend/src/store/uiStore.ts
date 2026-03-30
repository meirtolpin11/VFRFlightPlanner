import { create } from 'zustand'
import type { Airspace, Waypoint } from '@flight-planner/shared'

export interface PendingLegPoint {
  id: string
  name: string
  icaoCode?: string
  lat: number
  lon: number
  getWaypoint: () => Promise<Waypoint>
}

export interface PendingLeg {
  departure: PendingLegPoint
  intermediates: PendingLegPoint[]
}

interface WaypointCtx {
  legId: string
  flightId: string
  waypointIndex: number   // index in [departure, ...intermediates, arrival]
  totalWaypoints: number
}

interface ContextMenuPos {
  x: number
  y: number
  lat: number
  lon: number
  airspaces: Airspace[]
  waypointCtx?: WaypointCtx
}

interface UiStore {
  createTripOpen: boolean
  createFlightOpen: boolean
  createLegOpen: boolean
  airplanesOpen: boolean
  exportOpen: boolean
  exportLegId: string | null
  contextMenuPos: ContextMenuPos | null
  activeFlightId: string | null
  activeTripId: string | null
  pendingLeg: PendingLeg | null

  setCreateTripOpen: (v: boolean) => void
  setCreateFlightOpen: (v: boolean) => void
  setCreateLegOpen: (v: boolean) => void
  setAirplanesOpen: (v: boolean) => void
  openExport: (legId: string) => void
  closeExport: () => void
  setContextMenu: (pos: ContextMenuPos | null) => void
  setActiveFlightId: (id: string | null) => void
  setActiveTripId: (id: string | null) => void
  startPendingLeg: (departure: PendingLegPoint) => void
  addPendingLegIntermediate: (point: PendingLegPoint) => void
  clearPendingLeg: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  createTripOpen: false,
  createFlightOpen: false,
  createLegOpen: false,
  airplanesOpen: false,
  exportOpen: false,
  exportLegId: null,
  contextMenuPos: null,
  activeFlightId: null,
  activeTripId: null,
  pendingLeg: null,

  setCreateTripOpen: (v) => set({ createTripOpen: v }),
  setCreateFlightOpen: (v) => set({ createFlightOpen: v }),
  setCreateLegOpen: (v) => set({ createLegOpen: v }),
  setAirplanesOpen: (v) => set({ airplanesOpen: v }),
  openExport: (legId) => set({ exportOpen: true, exportLegId: legId }),
  closeExport: () => set({ exportOpen: false, exportLegId: null }),
  setContextMenu: (pos) => set({ contextMenuPos: pos }),
  setActiveFlightId: (id) => set({ activeFlightId: id }),
  setActiveTripId: (id) => set({ activeTripId: id }),
  startPendingLeg: (departure) => set({ pendingLeg: { departure, intermediates: [] } }),
  addPendingLegIntermediate: (point) =>
    set(s => s.pendingLeg
      ? { pendingLeg: { ...s.pendingLeg, intermediates: [...s.pendingLeg.intermediates, point] } }
      : s),
  clearPendingLeg: () => set({ pendingLeg: null }),
}))
