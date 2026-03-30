import { useState, useEffect, useRef, useMemo } from 'react'
import { Polyline, Tooltip, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { Leg, Airplane, Waypoint } from '@flight-planner/shared'
import { useSelectionStore } from '../../store/selectionStore'
import { useTripStore } from '../../store/tripStore'
import { useUiStore } from '../../store/uiStore'
import { haversineNm } from '../../utils/legCalc'
import { api } from '../../services/api'
import PointActions from './PointActions'

interface Props {
  leg: Leg
  flightId: string
  airplane?: Airplane
}

function waypointIcon(color: string, snapping = false) {
  const size = snapping ? 22 : 14
  const cx = size / 2
  const inner = snapping
    ? `<circle cx="${cx}" cy="${cx}" r="5" fill="${color}" stroke="white" stroke-width="2"/>
       <circle cx="${cx}" cy="${cx}" r="${cx - 1}" fill="none" stroke="${color}" stroke-width="2" opacity="0.7"/>`
    : `<circle cx="${cx}" cy="${cx}" r="${cx - 1.5}" fill="${color}" stroke="white" stroke-width="2"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${inner}</svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [cx, cx] })
}

function segmentLabelIcon(text: string) {
  return L.divIcon({
    html: `<div style="display:inline-block;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;line-height:1.4;padding:2px 5px;border-radius:3px;white-space:nowrap;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.4)">${text}</div>`,
    className: 'leaflet-label-icon',
    iconAnchor: [-4, -6],
  })
}

function getWaypointFn(wp: Waypoint): (() => Promise<Waypoint>) {
  const pad = 0.005
  const bbox = `${wp.lon - pad},${wp.lat - pad},${wp.lon + pad},${wp.lat + pad}`
  if (wp.waypointType === 'airport') {
    return async () => {
      const airports = await api.getAirports(bbox)
      const nearest = airports.sort((a, b) => haversineNm(wp.lat, wp.lon, a.lat, a.lon) - haversineNm(wp.lat, wp.lon, b.lat, b.lon))[0]
      return api.getOrCreateAirportWaypoint(nearest.id)
    }
  }
  if (wp.waypointType === 'vrp') {
    return async () => {
      const pts = await api.getReportingPoints(bbox)
      const nearest = pts.sort((a, b) => haversineNm(wp.lat, wp.lon, a.lat, a.lon) - haversineNm(wp.lat, wp.lon, b.lat, b.lon))[0]
      return api.getOrCreateReportingPointWaypoint(nearest.id)
    }
  }
  if (wp.waypointType === 'vor' || wp.waypointType === 'ndb') {
    return async () => {
      const pts = await api.getNavaids(bbox)
      const nearest = pts.sort((a, b) => haversineNm(wp.lat, wp.lon, a.lat, a.lon) - haversineNm(wp.lat, wp.lon, b.lat, b.lon))[0]
      return api.getOrCreateNavaidWaypoint(nearest.id)
    }
  }
  return () => Promise.resolve(wp)
}

function WaypointPopupContent({ wp }: { wp: Waypoint }) {
  const typeLabel = wp.waypointType === 'vrp' ? 'Reporting Point'
    : wp.waypointType === 'vor' ? 'VOR'
    : wp.waypointType === 'ndb' ? 'NDB'
    : wp.waypointType === 'airport' ? 'Airport'
    : 'Waypoint'

  return (
    <div className="text-sm min-w-[180px]">
      <div className="font-semibold">{wp.name}</div>
      {wp.icaoCode && <div className="font-mono text-xs text-blue-500">{wp.icaoCode}</div>}
      <div className="text-xs text-gray-500 mb-2">{typeLabel}</div>
      <PointActions point={{
        id: wp.id,
        name: wp.name,
        icaoCode: wp.icaoCode,
        lat: wp.lat,
        lon: wp.lon,
        getWaypoint: getWaypointFn(wp),
      }} />
    </div>
  )
}

export default function LegPolyline({ leg, flightId, airplane }: Props) {
  const selectLeg = useSelectionStore(s => s.selectLeg)
  const selectAirport = useSelectionStore(s => s.selectAirport)
  const selectedLegId = useSelectionStore(s => s.legId)
  const { updateLegWaypoints } = useTripStore()
  const setContextMenu = useUiStore(s => s.setContextMenu)

  const markerRefs = useRef<(L.Marker | null)[]>([])
  const [popupWpIdx, setPopupWpIdx] = useState<number | null>(null)

  useEffect(() => {
    if (popupWpIdx !== null) {
      markerRefs.current[popupWpIdx]?.openPopup()
    }
  }, [popupWpIdx])

  const handleMarkerClick = async (i: number, wp: Waypoint) => {
    if (wp.waypointType === 'airport') {
      const pad = 0.005
      const airports = await api.getAirports(`${wp.lon - pad},${wp.lat - pad},${wp.lon + pad},${wp.lat + pad}`)
      const nearest = airports.sort((a, b) => haversineNm(wp.lat, wp.lon, a.lat, a.lon) - haversineNm(wp.lat, wp.lon, b.lat, b.lon))[0]
      if (nearest) selectAirport(nearest)
      setPopupWpIdx(i)
      return
    }
    if (wp.waypointType === 'vrp' || wp.waypointType === 'vor' || wp.waypointType === 'ndb') {
      setPopupWpIdx(i)
      return
    }
    selectLeg(leg.id, flightId)
  }

  const waypoints = [leg.departure, ...leg.intermediates, leg.arrival]

  // Live drag positions tracked in a ref — updating this never triggers a re-render
  // so React-Leaflet can't accidentally call setLatLng on the dragging marker.
  const dragPosRef = useRef<([number, number] | null)[]>(waypoints.map(() => null))
  // Bump only to redraw the polyline and segment labels
  const [polylineTick, setPolylineTick] = useState(0)
  // Index of waypoint currently snapping to an airport
  const [snapIdx, setSnapIdx] = useState<number | null>(null)
  const snapCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable position references — React-Leaflet compares by reference; a new inline
  // array every render triggers setLatLng() mid-drag and snaps the marker back.
  const markerPositions = useMemo(
    () => waypoints.map(wp => [wp.lat, wp.lon] as [number, number]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [waypoints.map(wp => `${wp.id}:${wp.lat}:${wp.lon}`).join('|')]
  )

  // Stable icon references — React-Leaflet compares by reference; a new icon instance
  // every render triggers marker.setIcon() which replaces the DOM element mid-drag,
  // destroying the active drag handler.
  const markerIcons = useMemo(
    () => waypoints.map((_, i) => {
      const color = i === 0 ? '#22c55e' : i === waypoints.length - 1 ? '#ef4444' : '#f59e0b'
      return waypointIcon(color, snapIdx === i)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [waypoints.length, snapIdx]
  )

  useEffect(() => {
    dragPosRef.current = waypoints.map(() => null)
    setPolylineTick(t => t + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg.id, waypoints.length, leg.departure.id, leg.arrival.id])

  // suppress lint — polylineTick intentionally read only to force re-render
  void polylineTick

  const isSelected = selectedLegId === leg.id

  const polylinePositions: [number, number][] = waypoints.map((wp, i) =>
    dragPosRef.current[i] ?? [wp.lat, wp.lon]
  )

  const segments = waypoints.slice(0, -1).map((_, i) => {
    const [lat1, lon1] = polylinePositions[i]
    const [lat2, lon2] = polylinePositions[i + 1]
    const dist = haversineNm(lat1, lon1, lat2, lon2)
    const timeMin = airplane ? Math.round((dist / airplane.cruiseTasKts) * 60) : null
    return {
      midLat: (lat1 + lat2) / 2,
      midLon: (lon1 + lon2) / 2,
      label: `${dist.toFixed(0)} NM${timeMin ? ` · ${timeMin}m` : ''}`,
    }
  })

  const handleDragEnd = async (i: number, lat: number, lon: number) => {
    dragPosRef.current = dragPosRef.current.map((p, idx) => idx === i ? null : p)
    setPolylineTick(t => t + 1)
    try {
      const pad = 0.015
      const bbox = `${lon - pad},${lat - pad},${lon + pad},${lat + pad}`

      // Fetch all snap candidates in parallel
      const [airports, reportingPoints, navaids] = await Promise.all([
        api.getAirports(bbox),
        api.getReportingPoints(bbox),
        api.getNavaids(bbox),
      ])

      type Candidate = { dist: number; getWp: () => Promise<import('@flight-planner/shared').Waypoint> }
      const candidates: Candidate[] = [
        ...airports.map(a => ({ dist: haversineNm(lat, lon, a.lat, a.lon), getWp: () => api.getOrCreateAirportWaypoint(a.id) })),
        ...reportingPoints.map(r => ({ dist: haversineNm(lat, lon, r.lat, r.lon), getWp: () => api.getOrCreateReportingPointWaypoint(r.id) })),
        ...navaids.map(n => ({ dist: haversineNm(lat, lon, n.lat, n.lon), getWp: () => api.getOrCreateNavaidWaypoint(n.id) })),
      ].filter(c => c.dist <= 0.5).sort((a, b) => a.dist - b.dist)

      let newWp
      if (candidates.length > 0) {
        newWp = await candidates[0].getWp()
      } else {
        newWp = await api.createWaypoint({
          name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          lat,
          lon,
          waypointType: 'coordinate',
        })
      }

      const depId = i === 0 ? newWp.id : leg.departure.id
      const arrId = i === waypoints.length - 1 ? newWp.id : leg.arrival.id
      const intermediates = leg.intermediates.map((w, idx) =>
        idx === i - 1 ? newWp.id : w.id
      )
      await updateLegWaypoints(leg.id, depId, arrId, intermediates)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <>
      <Polyline
        positions={polylinePositions}
        pathOptions={{
          color: leg.color,
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 1 : 0.8,
        }}
        pane="routePane"          // polyline below airports
        eventHandlers={{ click: () => selectLeg(leg.id, flightId) }}
      >
        <Tooltip sticky>{leg.name || `${leg.departure.name} → ${leg.arrival.name}`}</Tooltip>
      </Polyline>

      {waypoints.map((wp, i) => (
          <Marker
            key={wp.id}
            ref={(m) => { markerRefs.current[i] = m }}
            position={markerPositions[i]}
            icon={markerIcons[i]}
            draggable={true}
            pane="routeMarkerPane"  // above airport markers so drag is reachable
            eventHandlers={{
              click: () => { handleMarkerClick(i, wp) },
              contextmenu: (e) => {
                const evt = (e as any).originalEvent as MouseEvent
                evt.preventDefault()
                evt.stopPropagation()
                setContextMenu({
                  x: evt.clientX,
                  y: evt.clientY,
                  lat: wp.lat,
                  lon: wp.lon,
                  airspaces: [],
                  waypointCtx: { legId: leg.id, flightId, waypointIndex: i, totalWaypoints: waypoints.length },
                })
              },
              drag: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng()
                dragPosRef.current[i] = [lat, lng]
                setPolylineTick(t => t + 1)
                // Debounced snap check
                if (snapCheckTimer.current) clearTimeout(snapCheckTimer.current)
                snapCheckTimer.current = setTimeout(async () => {
                  const pad = 0.015
                  const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`
                  try {
                    const [airports, reportingPoints, navaids] = await Promise.all([
                      api.getAirports(bbox),
                      api.getReportingPoints(bbox),
                      api.getNavaids(bbox),
                    ])
                    const hasNearby =
                      airports.some(a => haversineNm(lat, lng, a.lat, a.lon) <= 0.5) ||
                      reportingPoints.some(r => haversineNm(lat, lng, r.lat, r.lon) <= 0.5) ||
                      navaids.some(n => haversineNm(lat, lng, n.lat, n.lon) <= 0.5)
                    setSnapIdx(hasNearby ? i : null)
                  } catch { /* ignore */ }
                }, 150)
              },
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng()
                if (snapCheckTimer.current) clearTimeout(snapCheckTimer.current)
                setSnapIdx(null)
                handleDragEnd(i, lat, lng)
              },
            }}
          >
            <Tooltip>{wp.name}</Tooltip>
            {popupWpIdx === i && (
              <Popup eventHandlers={{ remove: () => setPopupWpIdx(null) }}>
                <WaypointPopupContent wp={wp} />
              </Popup>
            )}
          </Marker>
      ))}

      {segments.map((seg, i) => (
        <Marker
          key={`seg-${i}`}
          position={[seg.midLat, seg.midLon]}
          icon={segmentLabelIcon(seg.label)}
          pane="routePane"          // labels stay below airports
          interactive={false}
        />
      ))}
    </>
  )
}
