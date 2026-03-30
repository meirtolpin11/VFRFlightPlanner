import { create } from 'zustand'
import type { Trip, Flight, Leg } from '@flight-planner/shared'
import { api } from '../services/api'

interface TripStore {
  trips: Trip[]
  loading: boolean
  error: string | null

  fetchTrips: () => Promise<void>
  createTrip: (name: string, description?: string) => Promise<Trip>
  updateTrip: (id: string, patch: Partial<Trip>) => Promise<void>
  deleteTrip: (id: string) => Promise<void>

  createFlight: (tripId: string, name: string, airplaneId?: string) => Promise<Flight>
  updateFlight: (tripId: string, flightId: string, patch: Partial<Flight>) => Promise<void>
  deleteFlight: (tripId: string, flightId: string) => Promise<void>
  toggleFlightVisibility: (tripId: string, flightId: string) => void
  toggleTripVisibility: (tripId: string) => void

  createLeg: (flightId: string, data: { departureId: string; arrivalId: string; name?: string; color?: string }) => Promise<Leg>
  updateLeg: (flightId: string, legId: string, patch: Partial<Leg>) => Promise<void>
  deleteLeg: (flightId: string, legId: string) => Promise<void>
  toggleLegVisibility: (flightId: string, legId: string) => Promise<void>
  updateLegWaypoints: (legId: string, dep: string, arr: string, intermediates: string[]) => Promise<void>

  // Helpers
  getLeg: (legId: string) => Leg | null
  getFlight: (flightId: string) => (Flight & { tripId: string }) | null
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  loading: false,
  error: null,

  fetchTrips: async () => {
    set({ loading: true, error: null })
    try {
      const raw = await api.getTrips()
      // Ensure flights always have a legs array (defensive against legacy/partial responses)
      const trips = raw.map(t => ({
        ...t,
        flights: t.flights.map(f => ({ ...f, legs: f.legs ?? [] }))
      }))
      set({ trips, loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  createTrip: async (name, description) => {
    const trip = await api.createTrip({ name, description })
    set(s => ({ trips: [...s.trips, trip] }))
    return trip
  },

  updateTrip: async (id, patch) => {
    await api.updateTrip(id, patch)
    set(s => ({ trips: s.trips.map(t => t.id === id ? { ...t, ...patch } : t) }))
  },

  deleteTrip: async (id) => {
    await api.deleteTrip(id)
    set(s => ({ trips: s.trips.filter(t => t.id !== id) }))
  },

  createFlight: async (tripId, name, airplaneId) => {
    const flight = await api.createFlight(tripId, { name, airplaneId })
    set(s => ({
      trips: s.trips.map(t => t.id === tripId ? { ...t, flights: [...t.flights, flight] } : t)
    }))
    return flight
  },

  updateFlight: async (tripId, flightId, patch) => {
    await api.updateFlight(tripId, flightId, patch)
    set(s => ({
      trips: s.trips.map(t => t.id === tripId
        ? { ...t, flights: t.flights.map(f => f.id === flightId ? { ...f, ...patch } : f) }
        : t
      )
    }))
  },

  deleteFlight: async (tripId, flightId) => {
    await api.deleteFlight(tripId, flightId)
    set(s => ({
      trips: s.trips.map(t => t.id === tripId
        ? { ...t, flights: t.flights.filter(f => f.id !== flightId) }
        : t
      )
    }))
  },

  toggleFlightVisibility: (tripId, flightId) => {
    const trips = get().trips
    const flight = trips.find(t => t.id === tripId)?.flights.find(f => f.id === flightId)
    if (!flight) return
    const newVisible = !flight.visibleOnMap
    get().updateFlight(tripId, flightId, { visibleOnMap: newVisible })
  },

  toggleTripVisibility: (tripId) => {
    const trip = get().trips.find(t => t.id === tripId)
    if (!trip) return
    const allVisible = trip.flights.every(f => f.visibleOnMap)
    const newVisible = !allVisible
    for (const flight of trip.flights) {
      get().updateFlight(tripId, flight.id, { visibleOnMap: newVisible })
    }
  },

  createLeg: async (flightId, data) => {
    const leg = await api.createLeg(flightId, data)
    set(s => ({
      trips: s.trips.map(t => ({
        ...t,
        flights: t.flights.map(f => f.id === flightId ? { ...f, legs: [...f.legs, leg] } : f)
      }))
    }))
    return leg
  },

  updateLeg: async (_flightId, legId, patch) => {
    await api.updateLeg(_flightId, legId, patch)
    set(s => ({
      trips: s.trips.map(t => ({
        ...t,
        flights: t.flights.map(f => ({
          ...f,
          legs: f.legs.map(l => l.id === legId ? { ...l, ...patch } : l)
        }))
      }))
    }))
  },

  toggleLegVisibility: async (flightId, legId) => {
    const leg = get().getLeg(legId)
    if (!leg) return
    const newVisible = leg.visible !== false ? false : true
    await api.updateLeg(flightId, legId, { visible: newVisible } as any)
    set(s => ({
      trips: s.trips.map(t => ({
        ...t,
        flights: t.flights.map(f => ({
          ...f,
          legs: f.legs.map(l => l.id === legId ? { ...l, visible: newVisible } : l)
        }))
      }))
    }))
  },

  deleteLeg: async (flightId, legId) => {
    await api.deleteLeg(flightId, legId)
    set(s => ({
      trips: s.trips.map(t => ({
        ...t,
        flights: t.flights.map(f => f.id === flightId
          ? { ...f, legs: f.legs.filter(l => l.id !== legId) }
          : f
        )
      }))
    }))
  },

  updateLegWaypoints: async (legId, dep, arr, intermediates) => {
    await api.updateLegWaypoints(legId, dep, arr, intermediates)
    await get().fetchTrips()
  },

  getLeg: (legId) => {
    for (const t of get().trips) {
      for (const f of t.flights) {
        const l = f.legs.find(l => l.id === legId)
        if (l) return l
      }
    }
    return null
  },

  getFlight: (flightId) => {
    for (const t of get().trips) {
      const f = t.flights.find(f => f.id === flightId)
      if (f) return { ...f, tripId: t.id }
    }
    return null
  },
}))
