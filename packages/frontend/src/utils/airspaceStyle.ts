import type { AirspaceClass } from '@flight-planner/shared'

interface PathStyle {
  color: string
  fillColor: string
  fillOpacity: number
  weight: number
  dashArray?: string
  opacity: number
}

export function getAirspaceStyle(airspaceClass: AirspaceClass): PathStyle {
  const styles: Record<string, PathStyle> = {
    A: { color: '#ff2222', fillColor: '#ff2222', fillOpacity: 0.08, weight: 2, opacity: 0.8 },
    B: { color: '#0055ff', fillColor: '#0055ff', fillOpacity: 0.08, weight: 2, opacity: 0.8 },
    C: { color: '#0055ff', fillColor: '#0055ff', fillOpacity: 0.06, weight: 1.5, dashArray: '4,2', opacity: 0.8 },
    D: { color: '#0077dd', fillColor: '#0077dd', fillOpacity: 0.05, weight: 1.5, opacity: 0.7 },
    E: { color: '#aa00cc', fillColor: '#aa00cc', fillOpacity: 0.05, weight: 1, opacity: 0.6 },
    F: { color: '#888888', fillColor: 'transparent', fillOpacity: 0, weight: 1, dashArray: '3,3', opacity: 0.5 },
    G: { color: '#aaaaaa', fillColor: 'transparent', fillOpacity: 0, weight: 1, opacity: 0.4 },
  }
  return styles[airspaceClass] || styles['G']
}
