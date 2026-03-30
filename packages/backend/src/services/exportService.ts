import { Leg, Waypoint } from '@flight-planner/shared'

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getAllWaypoints(leg: Leg): Waypoint[] {
  return [leg.departure, ...leg.intermediates, leg.arrival]
}

export function generateGpx(leg: Leg): string {
  const waypoints = getAllWaypoints(leg)
  const wpts = waypoints.map(w => `  <wpt lat="${w.lat}" lon="${w.lon}"><name>${escapeXml(w.name)}</name>${w.elevationFt ? `<ele>${Math.round(w.elevationFt * 0.3048)}</ele>` : ''}</wpt>`).join('\n')
  const rtepts = waypoints.map(w => `    <rtept lat="${w.lat}" lon="${w.lon}"><name>${escapeXml(w.name)}</name></rtept>`).join('\n')
  const name = leg.name || `${leg.departure.name} → ${leg.arrival.name}`
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VFR Flight Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(name)}</name></metadata>
${wpts}
  <rte>
    <name>${escapeXml(name)}</name>
${rtepts}
  </rte>
</gpx>`
}

export function generatePln(leg: Leg): string {
  const waypoints = getAllWaypoints(leg)
  const atcWaypoints = waypoints.map((w, i) => {
    const type = w.icaoCode ? 'Airport' : 'User'
    const id = w.icaoCode || `U${String(i).padStart(3, '0')}`
    return `    <ATCWaypoint id="${escapeXml(id)}">
      <ATCWaypointType>${type}</ATCWaypointType>
      <WorldPosition>${formatDMS(w.lat, 'lat')},${formatDMS(w.lon, 'lon')},+${String(Math.round((w.elevationFt || 0) * 0.3048)).padStart(6, '0')}.00</WorldPosition>
      <ICAO><ICAOIdent>${escapeXml(id)}</ICAOIdent></ICAO>
    </ATCWaypoint>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<SimBase.Document Type="AceXML" version="1,0">
  <FlightPlan.FlightPlan>
    <Title>${escapeXml(leg.name || `${leg.departure.name} to ${leg.arrival.name}`)}</Title>
    <FPType>VFR</FPType>
    <DepartureID>${escapeXml(leg.departure.icaoCode || leg.departure.name)}</DepartureID>
    <DestinationID>${escapeXml(leg.arrival.icaoCode || leg.arrival.name)}</DestinationID>
${atcWaypoints}
  </FlightPlan.FlightPlan>
</SimBase.Document>`
}

export function generateFpl(leg: Leg): string {
  const waypoints = getAllWaypoints(leg)
  const wptElements = waypoints.map(w => {
    const id = (w.icaoCode || w.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 17))
    const type = w.icaoCode ? 'AIRPORT' : 'USER WAYPOINT'
    return `    <waypoint>
      <name>${escapeXml(id)}</name>
      <type>${type}</type>
      <country-code>${'--'}</country-code>
      <lat>${w.lat.toFixed(8)}</lat>
      <lon>${w.lon.toFixed(8)}</lon>
    </waypoint>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<flight-plan xmlns="http://www8.garmin.com/xmlschemas/FlightPlan/v1">
  <created>${new Date().toISOString()}</created>
  <waypoint-table>
${wptElements}
  </waypoint-table>
  <route>
    <route-name>${escapeXml(leg.name || `${leg.departure.name} to ${leg.arrival.name}`)}</route-name>
    <flight-plan-index>1</flight-plan-index>
${waypoints.map((w) => `    <route-point>
      <waypoint-identifier>${escapeXml((w.icaoCode || w.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 17)))}</waypoint-identifier>
      <waypoint-type>${w.icaoCode ? 'AIRPORT' : 'USER WAYPOINT'}</waypoint-type>
    </route-point>`).join('\n')}
  </route>
</flight-plan>`
}

function formatDMS(deg: number, type: 'lat' | 'lon'): string {
  const abs = Math.abs(deg)
  const d = Math.floor(abs)
  const m = Math.floor((abs - d) * 60)
  const s = ((abs - d) * 60 - m) * 60
  const dir = type === 'lat' ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W')
  return `${dir}${String(d).padStart(type === 'lat' ? 2 : 3, '0')}° ${String(m).padStart(2, '0')}' ${s.toFixed(2)}"`.replace(' ', '+')
}
