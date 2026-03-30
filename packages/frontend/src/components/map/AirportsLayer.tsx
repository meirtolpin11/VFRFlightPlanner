import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { Airport } from '@flight-planner/shared'
import { useAirports } from '../../hooks/useAirports'
import { useSelectionStore } from '../../store/selectionStore'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { api } from '../../services/api'
import PointActions from './PointActions'

function makeAirportIcon(color: string, fillColor: string, size: number) {
  const cx = size / 2
  const r = cx - 1.5
  const ir = Math.max(2.5, cx * 0.35)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${cx}" cy="${cx}" r="${r}" fill="${fillColor}" stroke="${color}" stroke-width="2" fill-opacity="0.9"/><circle cx="${cx}" cy="${cx}" r="${ir}" fill="${color}"/></svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [cx, cx], popupAnchor: [0, -cx] })
}

export default function AirportsLayer() {
  const { data: airports } = useAirports()
  const selectAirport = useSelectionStore(s => s.selectAirport)
  const pendingLeg = useUiStore(s => s.pendingLeg)
  const zoom = useMapStore(s => s.currentZoom)

  if (!airports || zoom < 8) return null

  return (
    <>
      {airports.map(airport => {
        const isPendingDep = pendingLeg?.departure.id === airport.id
        const isPendingInt = pendingLeg?.intermediates.some(a => a.id === airport.id)
        const isMilitary = airport.airportType === 5
        return (
          <Marker
            key={airport.id}
            position={[airport.lat, airport.lon]}
            icon={makeAirportIcon(
              isPendingDep ? '#f59e0b' : isPendingInt ? '#8b5cf6' : isMilitary ? '#dc2626' : '#2563eb',
              isPendingDep ? '#fbbf24' : isPendingInt ? '#a78bfa' : isMilitary ? '#fca5a5' : '#93c5fd',
              isPendingDep ? 14 : 12
            )}
            pane="airportPane"
            eventHandlers={{ click: (e) => { (e as any).originalEvent?.stopPropagation(); selectAirport(airport) } }}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <div className="font-semibold text-sm">{airport.name}</div>
                {airport.icaoCode && <div className="font-mono text-xs text-blue-500">{airport.icaoCode}</div>}
                {(airport.elevationFt != null || airport.country) && (
                  <div className="text-xs text-gray-400">
                    {[airport.elevationFt != null ? `${airport.elevationFt} ft` : null, airport.country || null].filter(Boolean).join(' · ')}
                  </div>
                )}
                <hr className="my-2 border-gray-200" />
                <PointActions point={{
                  id: airport.id,
                  name: airport.name,
                  icaoCode: airport.icaoCode,
                  lat: airport.lat,
                  lon: airport.lon,
                  getWaypoint: () => api.getOrCreateAirportWaypoint(airport.id),
                }} />
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}
