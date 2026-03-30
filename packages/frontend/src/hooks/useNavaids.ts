import { useQuery } from '@tanstack/react-query'
import { useMapStore } from '../store/mapStore'
import { api } from '../services/api'

export function useNavaids() {
  const bounds = useMapStore(s => s.currentBounds)
  const zoom = useMapStore(s => s.currentZoom)
  const show = useMapStore(s => s.showNavaids)

  const bbox = bounds
    ? `${bounds.minLon.toFixed(4)},${bounds.minLat.toFixed(4)},${bounds.maxLon.toFixed(4)},${bounds.maxLat.toFixed(4)}`
    : null

  return useQuery({
    queryKey: ['navaids', bbox],
    queryFn: () => api.getNavaids(bbox!),
    enabled: !!bbox && show && zoom >= 7,
    staleTime: 10 * 60 * 1000,
  })
}
