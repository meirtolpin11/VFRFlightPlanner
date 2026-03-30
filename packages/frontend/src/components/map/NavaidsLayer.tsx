import { CircleMarker, Popup } from 'react-leaflet'
import { useNavaids } from '../../hooks/useNavaids'
import { useMapStore } from '../../store/mapStore'
import { api } from '../../services/api'
import PointActions from './PointActions'

const VOR_TYPES = [3, 4, 5]
const NDB_TYPES = [2, 7]

function NavaidTypeLabel(type: number): string {
  const labels: Record<number, string> = { 2: 'NDB', 3: 'VOR', 4: 'VOR/DME', 5: 'VORTAC', 7: 'NDB/DME' }
  return labels[type] || 'NAVAID'
}

export default function NavaidsLayer() {
  const { data: navaids } = useNavaids()
  const zoom = useMapStore(s => s.currentZoom)
  if (!navaids || zoom < 9) return null

  return (
    <>
      {navaids.map(navaid => {
        const isVor = VOR_TYPES.includes(navaid.navaidType)
        return (
          <CircleMarker
            key={navaid.id}
            center={[navaid.lat, navaid.lon]}
            radius={isVor ? 6 : 5}
            pathOptions={{
              color: isVor ? '#0891b2' : '#ea580c',
              fillColor: isVor ? '#06b6d4' : '#fb923c',
              fillOpacity: 0.7,
              weight: 2,
            }}
            pane="markerPane"
          >
            <Popup>
              <div className="text-sm min-w-[150px]">
                <div className="font-semibold">{navaid.name}</div>
                {navaid.ident && <div className="font-mono text-xs text-blue-500">{navaid.ident}</div>}
                <div className="text-xs text-gray-500 mb-2">
                  {NavaidTypeLabel(navaid.navaidType)}
                  {navaid.frequency ? ` · ${navaid.frequency} ${isVor ? 'MHz' : 'kHz'}` : ''}
                </div>
                <PointActions point={{
                  id: navaid.id,
                  name: navaid.name,
                  icaoCode: navaid.ident || undefined,
                  lat: navaid.lat,
                  lon: navaid.lon,
                  getWaypoint: () => api.getOrCreateNavaidWaypoint(navaid.id),
                }} />
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
