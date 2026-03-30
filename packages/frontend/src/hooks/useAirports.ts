import { useQuery } from '@tanstack/react-query'
import { useMapStore } from '../store/mapStore'
import { api } from '../services/api'

export function useAirports() {
  const bounds = useMapStore(s => s.currentBounds)
  const zoom = useMapStore(s => s.currentZoom)
  const show = useMapStore(s => s.showAirports)

  const bbox = bounds
    ? `${bounds.minLon.toFixed(4)},${bounds.minLat.toFixed(4)},${bounds.maxLon.toFixed(4)},${bounds.maxLat.toFixed(4)}`
    : null

  return useQuery({
    queryKey: ['airports', bbox],
    queryFn: () => api.getAirports(bbox!),
    enabled: !!bbox && show && zoom >= 7,
    staleTime: 10 * 60 * 1000,
  })
}
