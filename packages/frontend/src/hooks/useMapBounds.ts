import { useEffect, useRef } from 'react'
import { useMapEvents } from 'react-leaflet'
import type { Map } from 'leaflet'
import { useMapStore } from '../store/mapStore'

export function useMapBounds() {
  const setCurrentBounds = useMapStore(s => s.setCurrentBounds)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateBounds = (map: Map) => {
    const b = map.getBounds()
    const bounds = {
      minLon: b.getWest(),
      minLat: b.getSouth(),
      maxLon: b.getEast(),
      maxLat: b.getNorth(),
    }
    setCurrentBounds(bounds, map.getZoom())
  }

  const map = useMapEvents({
    moveend: () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => updateBounds(map), 300)
    },
    zoomend: () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => updateBounds(map), 300)
    },
    load: () => updateBounds(map),
  })

  useEffect(() => {
    updateBounds(map)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  return null
}
