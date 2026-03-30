import { useQuery } from '@tanstack/react-query'
import { useMapStore } from '../store/mapStore'
import { api } from '../services/api'

export function useAirspaces() {
  const bounds = useMapStore(s => s.currentBounds)
  const zoom = useMapStore(s => s.currentZoom)
  const show = useMapStore(s => s.showAirspaces)

  const bbox = bounds
    ? `${bounds.minLon.toFixed(4)},${bounds.minLat.toFixed(4)},${bounds.maxLon.toFixed(4)},${bounds.maxLat.toFixed(4)}`
    : null

  return useQuery({
    queryKey: ['airspaces', bbox],
    queryFn: () => api.getAirspaces(bbox!),
    enabled: !!bbox && show && zoom >= 8,
    staleTime: 5 * 60 * 1000,
  })
}
