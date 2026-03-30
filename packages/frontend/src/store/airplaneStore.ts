import { create } from 'zustand'
import type { Airplane } from '@flight-planner/shared'
import { api } from '../services/api'

interface AirplaneStore {
  airplanes: Airplane[]
  loading: boolean

  fetchAirplanes: () => Promise<void>
  createAirplane: (data: Omit<Airplane, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateAirplane: (id: string, data: Partial<Airplane>) => Promise<void>
  deleteAirplane: (id: string) => Promise<void>
}

export const useAirplaneStore = create<AirplaneStore>((set, get) => ({
  airplanes: [],
  loading: false,

  fetchAirplanes: async () => {
    set({ loading: true })
    const airplanes = await api.getAirplanes()
    set({ airplanes, loading: false })
  },

  createAirplane: async (data) => {
    await api.createAirplane(data)
    get().fetchAirplanes()
  },

  updateAirplane: async (id, data) => {
    await api.updateAirplane(id, data)
    get().fetchAirplanes()
  },

  deleteAirplane: async (id) => {
    await api.deleteAirplane(id)
    get().fetchAirplanes()
  },
}))
