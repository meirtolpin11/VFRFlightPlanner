export type MarkerType = 'fuel' | 'avoid' | 'info' | 'checkpoint' | 'alternate'

export interface CustomMarker {
  id: string
  waypointId: string
  label: string
  markerType: MarkerType
  color?: string
  createdAt: string
}

export interface CreateMarkerInput {
  waypointId: string
  label: string
  markerType: MarkerType
  color?: string
}
