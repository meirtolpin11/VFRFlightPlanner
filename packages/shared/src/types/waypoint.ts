export type WaypointType = 'airport' | 'vrp' | 'vor' | 'ndb' | 'custom' | 'coordinate'

export interface Waypoint {
  id: string
  name: string
  icaoCode?: string
  waypointType: WaypointType
  lat: number
  lon: number
  elevationFt?: number
  notes?: string
  isCustom: boolean
  createdAt: string
}

export interface CreateWaypointInput {
  name: string
  icaoCode?: string
  waypointType: WaypointType
  lat: number
  lon: number
  elevationFt?: number
  notes?: string
}
