import { create } from 'zustand'

interface MapBounds {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

interface MapStore {
  showBaseLayer: boolean
  showAeroLayer: boolean
  showAirspaces: boolean
  showAirports: boolean
  showCustomPoints: boolean
  showReportingPoints: boolean
  showNavaids: boolean
  showGafor: boolean
  showWind: boolean
  windAltitude: string
  currentBounds: MapBounds | null
  currentZoom: number
  flyToTarget: { lat: number; lon: number; zoom: number } | null

  setShowBaseLayer: (v: boolean) => void
  setShowAeroLayer: (v: boolean) => void
  setShowAirspaces: (v: boolean) => void
  setShowAirports: (v: boolean) => void
  setShowCustomPoints: (v: boolean) => void
  setShowReportingPoints: (v: boolean) => void
  setShowNavaids: (v: boolean) => void
  setShowGafor: (v: boolean) => void
  setShowWind: (v: boolean) => void
  setWindAltitude: (v: string) => void
  setCurrentBounds: (bounds: MapBounds, zoom: number) => void
  flyTo: (lat: number, lon: number, zoom?: number) => void
}

export const useMapStore = create<MapStore>((set) => ({
  showBaseLayer: true,
  showAeroLayer: true,
  showAirspaces: true,
  showAirports: true,
  showCustomPoints: true,
  showReportingPoints: true,
  showNavaids: true,
  showGafor: false,
  showWind: false,
  windAltitude: 'sfc',
  currentBounds: null,
  currentZoom: 8,
  flyToTarget: null,

  setShowBaseLayer: (v) => set({ showBaseLayer: v }),
  setShowAeroLayer: (v) => set({ showAeroLayer: v }),
  setShowAirspaces: (v) => set({ showAirspaces: v }),
  setShowAirports: (v) => set({ showAirports: v }),
  setShowCustomPoints: (v) => set({ showCustomPoints: v }),
  setShowReportingPoints: (v) => set({ showReportingPoints: v }),
  setShowNavaids: (v) => set({ showNavaids: v }),
  setShowGafor: (v) => set({ showGafor: v }),
  setShowWind: (v) => set({ showWind: v }),
  setWindAltitude: (v) => set({ windAltitude: v }),
  setCurrentBounds: (bounds, zoom) => set({ currentBounds: bounds, currentZoom: zoom }),
  flyTo: (lat, lon, zoom = 11) => set({ flyToTarget: { lat, lon, zoom } }),
}))
