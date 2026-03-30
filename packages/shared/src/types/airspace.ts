export type AirspaceClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export interface AirspaceLimit {
  value: number
  unit: string
  referenceDatum: string
}

export interface Airspace {
  id: string
  oaipId: string
  name: string
  airspaceClass: AirspaceClass
  airspaceType: number
  upperLimitFt: number
  upperLimitRef: string
  lowerLimitFt: number
  lowerLimitRef: string
  country: string
  // GeoJSON polygon boundary
  boundary: GeoJSONPolygon
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}
