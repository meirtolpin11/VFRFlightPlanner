import type { Airplane } from './airplane'
import type { Leg } from './leg'

export interface Flight {
  id: string
  tripId: string
  name: string
  airplane?: Airplane
  airplaneId?: string
  legs: Leg[]
  sortOrder: number
  visibleOnMap: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateFlightInput {
  name: string
  airplaneId?: string
  sortOrder?: number
}
