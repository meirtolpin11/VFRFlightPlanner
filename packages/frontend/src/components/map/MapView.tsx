import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { useMapStore } from '../../store/mapStore'
import { useMapBounds } from '../../hooks/useMapBounds'
import { useUiStore } from '../../store/uiStore'
import AirspacesLayer from './AirspacesLayer'
import AirportsLayer from './AirportsLayer'
import FlightRoutesLayer from './FlightRoutesLayer'
import MapContextMenu from './MapContextMenu'
import ReportingPointsLayer from './ReportingPointsLayer'
import NavaidsLayer from './NavaidsLayer'
import WindLayer, { WIND_ALTITUDES } from './WindLayer'
import GaforLayer from './GaforLayer'

function AirportPaneSetup() {
  const map = useMap()
  useEffect(() => {
    if (!map.getPane('airportPane')) {
      const pane = map.createPane('airportPane')
      pane.style.zIndex = '620'
      pane.style.pointerEvents = 'auto'
    }
  }, [map])
  return null
}

function RoutePaneSetup() {
  const map = useMap()
  useEffect(() => {
    if (!map.getPane('routePane')) {
      const pane = map.createPane('routePane')
      pane.style.zIndex = '420'   // below airports — polylines + labels
      pane.style.pointerEvents = 'none'
    }
    if (!map.getPane('routeMarkerPane')) {
      const pane = map.createPane('routeMarkerPane')
      pane.style.zIndex = '640'   // above airportPane(620) — draggable waypoint dots
      pane.style.pointerEvents = 'auto'
    }
  }, [map])
  return null
}

function FlyToHandler() {
  const map = useMap()
  const flyToTarget = useMapStore(s => s.flyToTarget)
  const prev = useRef<typeof flyToTarget>(null)
  useEffect(() => {
    if (!flyToTarget || flyToTarget === prev.current) return
    prev.current = flyToTarget
    map.flyTo([flyToTarget.lat, flyToTarget.lon], flyToTarget.zoom, { animate: true, duration: 0.8 })
  }, [flyToTarget, map])
  return null
}

function MapInner() {
  useMapBounds()
  return (
    <>
      <AirportPaneSetup />
      <RoutePaneSetup />
      <FlyToHandler />
      <AirspacesLayer />
      <AirportsLayer />
      <ReportingPointsLayer />
      <NavaidsLayer />
      <FlightRoutesLayer />
      <WindLayer />
      <GaforLayer />
      <MapContextMenu />
    </>
  )
}

function LegBuilderBanner() {
  const pendingLeg = useUiStore(s => s.pendingLeg)
  const clearPendingLeg = useUiStore(s => s.clearPendingLeg)
  if (!pendingLeg) return null
  const stops = [pendingLeg.departure, ...pendingLeg.intermediates]
    .map(a => a.icaoCode || a.name).join(' → ')
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
      <div className="flex items-center gap-3 bg-blue-600 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg">
        <span>✈ Building leg: {stops} → click next airport</span>
        <button onClick={clearPendingLeg} className="hover:text-blue-200 font-bold text-sm leading-none">✕</button>
      </div>
    </div>
  )
}

function WindAltitudePicker() {
  const showWind = useMapStore(s => s.showWind)
  const windAltitude = useMapStore(s => s.windAltitude)
  const setWindAltitude = useMapStore(s => s.setWindAltitude)
  if (!showWind) return null
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
      <div className="flex gap-1 bg-fp-panel/95 border border-fp-border rounded-full px-2 py-1 shadow-lg">
        {WIND_ALTITUDES.map(alt => (
          <button
            key={alt.key}
            title={alt.title}
            onClick={() => setWindAltitude(alt.key)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
              windAltitude === alt.key
                ? 'bg-fp-accent text-white'
                : 'text-fp-muted hover:text-fp-text hover:bg-fp-border'
            }`}
          >
            {alt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MapView() {
  const { showBaseLayer, showAeroLayer } = useMapStore()

  return (
    <div className="relative w-full h-full">
      <LegBuilderBanner />
      <WindAltitudePicker />
      <MapContainer
        center={[50.0, 10.0]}
        zoom={7}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        doubleClickZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>"
          maxZoom={19}
          opacity={showBaseLayer ? 0 : 0.6}
        />
        {showBaseLayer && (
          <TileLayer
            url="https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.jpg?path=2603/base/latest"
            minZoom={7}
            maxZoom={17}
            maxNativeZoom={12}
            attribution="&copy; <a href='https://openflightmaps.org'>OpenFlightMaps</a>"
          />
        )}
        {showAeroLayer && (
          <TileLayer
            url="https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=2603/aero/latest"
            minZoom={7}
            maxZoom={17}
            maxNativeZoom={12}
            opacity={0.85}
          />
        )}
        <MapInner />
      </MapContainer>
    </div>
  )
}
