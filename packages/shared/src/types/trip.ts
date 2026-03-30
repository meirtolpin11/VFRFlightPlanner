import type { Flight } from './flight'

export interface Trip {
  id: string
  name: string
  description?: string
  flights: Flight[]
  createdAt: string
  updatedAt: string
}

export interface CreateTripInput {
  name: string
  description?: string
}
