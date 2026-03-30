import { CircleMarker, Popup } from 'react-leaflet'
import { useReportingPoints } from '../../hooks/useReportingPoints'
import { useMapStore } from '../../store/mapStore'
import { api } from '../../services/api'
import PointActions from './PointActions'

export default function ReportingPointsLayer() {
  const { data: points } = useReportingPoints()
  const zoom = useMapStore(s => s.currentZoom)

  if (!points || zoom < 9) return null

  return (
    <>
      {points.map(point => (
        <CircleMarker
          key={point.id}
          center={[point.lat, point.lon]}
          radius={point.compulsory ? 5 : 4}
          pathOptions={{
            color: '#7e22ce',
            fillColor: point.compulsory ? '#c026d3' : 'transparent',
            fillOpacity: point.compulsory ? 0.8 : 0,
            weight: 2,
          }}
          pane="markerPane"
        >
          <Popup>
            <div className="text-sm min-w-[160px]">
              <div className="font-semibold">{point.name}</div>
              <div className="text-xs text-gray-500 mb-2">
                {point.compulsory ? 'Compulsory VRP' : 'Non-compulsory VRP'}
              </div>
              <PointActions point={{
                id: point.id,
                name: point.name,
                lat: point.lat,
                lon: point.lon,
                getWaypoint: () => api.getOrCreateReportingPointWaypoint(point.id),
              }} />
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}
