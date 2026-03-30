import type { Waypoint } from './waypoint'

export interface AltitudePoint {
  distNm: number
  altFt: number
}

export interface Leg {
  id: string
  flightId: string
  sortOrder: number
  name?: string
  departure: Waypoint
  arrival: Waypoint
  intermediates: Waypoint[]
  color: string
  notes?: string
  visible: boolean
  altitudeProfile: AltitudePoint[]
  createdAt: string
  updatedAt: string
}

export interface LegStats {
  distanceNm: number
  eteMinutes: number
  fuelBurn: number
  fuelUnit: 'gal' | 'L'
}

export interface LegMessage {
  id: string
  legId: string
  authorName: string
  body: string
  createdAt: string
}

export interface CreateLegInput {
  name?: string
  departureId: string
  arrivalId: string
  intermediateIds?: string[]
  color?: string
  notes?: string
}

export interface UpdateLegWaypointsInput {
  departureId: string
  arrivalId: string
  intermediates: string[]
}
