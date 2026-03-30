import { useState, useEffect } from 'react'
import type { Airport } from '@flight-planner/shared'
import { useSelectionStore } from '../../store/selectionStore'
import { useTripStore } from '../../store/tripStore'
import { api } from '../../services/api'
import { useAirspaces } from '../../hooks/useAirspaces'
import { insertAtOptimalPosition } from '../../utils/legCalc'

interface Props { airport: Airport }

function pointInPolygon(lat: number, lon: number, coords: number[][]): boolean {
  let inside = false
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1]
    const xj = coords[j][0], yj = coords[j][1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function formatAlt(ft: number, ref: string): string {
  return `${ft} ft ${ref === 'FL' ? 'MSL' : ref}`
}

const AIRSPACE_CLASS_COLOR: Record<string, string> = {
  A: 'text-red-400', B: 'text-red-400',
  C: 'text-blue-400', D: 'text-blue-400',
  E: 'text-fuchsia-400',
}

// Country → NOTAM service URL
const NOTAM_URLS: Record<string, { label: string; url: string }> = {
  CZ: { label: 'AISView (LRA)', url: 'https://aisview.rlp.cz/' },
  DE: { label: 'DFS SECAIS', url: 'https://secais.dfs.de/piloten-service/' },
  AT: { label: 'Austrocontrol AIS', url: 'https://www.austrocontrol.at/pilot_service/notam/notam_search.html' },
  SK: { label: 'LPS AIS', url: 'https://lis.lps.sk/' },
  PL: { label: 'PANSA NOTAMs', url: 'https://notam.pansa.pl/' },
  HU: { label: 'HungaroControl', url: 'https://www.hungarocontrol.hu/nav-services/notam/' },
  FR: { label: 'SIA France', url: 'https://sofia-briefing.aviation-civile.gouv.fr/' },
  CH: { label: 'Skyguide AIS', url: 'https://www.skybriefing.com/' },
  NL: { label: 'LVNL NOTAMs', url: 'https://www.notams.nl/' },
}

interface MetarData {
  rawOb: string
  temp?: number
  dewp?: number
  wdir?: number
  wspd?: number
  wgst?: number
  visib?: number | string
  altim?: number
  flightCategory?: string
  clouds?: { cover: string; base: number }[]
  wxString?: string
}

interface TafData {
  rawTAF: string
  validTimeFrom?: number
  validTimeTo?: number
  issueTime?: string
}

function flightCategoryColor(cat?: string) {
  if (cat === 'VFR') return 'text-green-400'
  if (cat === 'MVFR') return 'text-blue-400'
  if (cat === 'IFR') return 'text-red-400'
  if (cat === 'LIFR') return 'text-fuchsia-400'
  return 'text-fp-muted'
}

function formatVisibility(visib: number | string | undefined): string | null {
  if (visib == null) return null
  if (visib === '6+' || visib === 6 || Number(visib) >= 6) return '> 10 km'
  const km = Number(visib) * 1.852
  return `${km.toFixed(1)} km`
}

function formatQnh(altim: number | undefined): string | null {
  if (altim == null) return null
  // altim > 100 → already hPa (European METAR Q-group); otherwise inHg
  if (altim > 100) return `${Math.round(altim)} hPa`
  return `${(altim * 33.8639).toFixed(0)} hPa (${altim.toFixed(2)} inHg)`
}

function MetarSection({ icao }: { icao: string }) {
  const [metar, setMetar] = useState<MetarData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/wx/metar/${icao}`)
      .then(r => r.json())
      .then((data: MetarData[]) => { setMetar(data?.[0] ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [icao])

  if (loading) return <div className="text-xs text-fp-muted">Loading…</div>
  if (!metar) return <div className="text-xs text-fp-muted">No METAR available</div>

  const windStr = metar.wdir != null && metar.wspd != null
    ? `${metar.wdir}° / ${metar.wspd} kt${metar.wgst ? ` G${metar.wgst}` : ''}`
    : null
  const ceiling = metar.clouds?.find(c => c.cover === 'BKN' || c.cover === 'OVC')
  const ceilStr = ceiling ? `${ceiling.cover} ${ceiling.base} ft` : null
  const visStr = formatVisibility(metar.visib)
  const qnhStr = formatQnh(metar.altim)

  return (
    <div className="space-y-1.5">
      {metar.flightCategory && (
        <div className={`text-xs font-bold ${flightCategoryColor(metar.flightCategory)}`}>
          {metar.flightCategory}
        </div>
      )}
      <div className="text-xs font-mono bg-fp-bg rounded px-2 py-1.5 text-fp-muted leading-relaxed break-all">
        {metar.rawOb}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        {windStr && <><span className="text-fp-muted">Wind</span><span className="text-fp-text">{windStr}</span></>}
        {visStr && <><span className="text-fp-muted">Vis</span><span className="text-fp-text">{visStr}</span></>}
        {ceilStr && <><span className="text-fp-muted">Ceiling</span><span className="text-fp-text">{ceilStr}</span></>}
        {metar.temp != null && <><span className="text-fp-muted">Temp/Dew</span><span className="text-fp-text">{metar.temp}° / {metar.dewp ?? '—'}°</span></>}
        {qnhStr && <><span className="text-fp-muted">QNH</span><span className="text-fp-text">{qnhStr}</span></>}
      </div>
    </div>
  )
}

function TafSection({ icao }: { icao: string }) {
  const [taf, setTaf] = useState<TafData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/wx/taf/${icao}`)
      .then(r => r.json())
      .then((data: TafData[]) => { setTaf(data?.[0] ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [icao])

  if (loading) return <div className="text-xs text-fp-muted">Loading…</div>
  if (!taf) return <div className="text-xs text-fp-muted">No TAF available</div>

  const from = taf.validTimeFrom ? new Date(taf.validTimeFrom * 1000).toUTCString().slice(5, 22) : null
  const to = taf.validTimeTo ? new Date(taf.validTimeTo * 1000).toUTCString().slice(5, 22) : null

  return (
    <div className="space-y-1">
      {from && to && (
        <div className="text-xs text-fp-muted">Valid: {from} – {to} UTC</div>
      )}
      <pre className="text-xs font-mono bg-fp-bg rounded px-2 py-1.5 text-fp-muted leading-relaxed whitespace-pre-wrap break-all">
        {taf.rawTAF}
      </pre>
    </div>
  )
}

function NotamsSection({ country, icao }: { country?: string; icao: string }) {
  const link = country ? NOTAM_URLS[country] : null
  return (
    <div className="space-y-1.5">
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-fp-accent hover:underline"
        >
          {link.label} ↗
        </a>
      ) : (
        <a
          href={`https://www.notams.faa.gov/common/icao/${icao}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-fp-accent hover:underline"
        >
          ICAO NOTAM search — {icao} ↗
        </a>
      )}
      <div className="text-xs text-fp-muted">Opens national AIS in a new tab</div>
    </div>
  )
}

export default function AirportDetailPanel({ airport }: Props) {
  const { legId } = useSelectionStore()
  const { getLeg, updateLegWaypoints } = useTripStore()
  const [busy, setBusy] = useState(false)

  const activeLeg = legId ? getLeg(legId) : null

  const { data: airspaces = [] } = useAirspaces()
  const localAirspaces = airspaces
    .filter(a => pointInPolygon(airport.lat, airport.lon, a.boundary.coordinates[0]))
    .sort((a, b) => a.lowerLimitFt - b.lowerLimitFt)

  const useAsWaypoint = async (role: 'dep' | 'arr' | 'intermediate') => {
    if (!activeLeg || !legId) return
    setBusy(true)
    try {
      const waypoint = await api.getOrCreateAirportWaypoint(airport.id)
      const depId = role === 'dep' ? waypoint.id : activeLeg.departure.id
      const arrId = role === 'arr' ? waypoint.id : activeLeg.arrival.id
      const allWps = [activeLeg.departure, ...activeLeg.intermediates, activeLeg.arrival]
      const intermediates = role === 'intermediate'
        ? insertAtOptimalPosition(allWps, waypoint.id, airport.lat, airport.lon)
        : activeLeg.intermediates.map(w => w.id)
      await updateLegWaypoints(legId, depId, arrId, intermediates)
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="p-3 border-b border-fp-border">
        <div className="font-semibold text-sm">{airport.name}</div>
        {airport.icaoCode && <div className="text-fp-accent font-mono text-xs mt-0.5">{airport.icaoCode}</div>}
        <div className="text-fp-muted text-xs mt-1">
          {airport.elevationFt != null ? `${airport.elevationFt} ft AMSL` : ''}
          {airport.country ? ` · ${airport.country}` : ''}
        </div>
        <div className="text-fp-muted text-xs">{airport.lat.toFixed(4)}°, {airport.lon.toFixed(4)}°</div>
      </div>

      {activeLeg && (
        <div className="p-3 border-b border-fp-border">
          <div className="text-xs text-fp-muted mb-2 uppercase tracking-wide">Add to leg</div>
          <div className="flex flex-col gap-1.5">
            <button onClick={() => useAsWaypoint('dep')} disabled={busy}
              className="text-xs px-2 py-1 bg-green-700/30 hover:bg-green-700/50 text-green-400 rounded disabled:opacity-50 text-left">
              Set as departure
            </button>
            <button onClick={() => useAsWaypoint('arr')} disabled={busy}
              className="text-xs px-2 py-1 bg-red-700/30 hover:bg-red-700/50 text-red-400 rounded disabled:opacity-50 text-left">
              Set as arrival
            </button>
            <button onClick={() => useAsWaypoint('intermediate')} disabled={busy}
              className="text-xs px-2 py-1 bg-fp-border hover:bg-fp-border/80 text-fp-text rounded disabled:opacity-50 text-left">
              Add as intermediate
            </button>
          </div>
        </div>
      )}

      {airport.icaoCode && (
        <div className="p-3 border-b border-fp-border">
          <div className="text-xs text-fp-muted mb-2 uppercase tracking-wide">METAR</div>
          <MetarSection icao={airport.icaoCode} />
        </div>
      )}

      {airport.icaoCode && (
        <div className="p-3 border-b border-fp-border">
          <div className="text-xs text-fp-muted mb-2 uppercase tracking-wide">TAF</div>
          <TafSection icao={airport.icaoCode} />
        </div>
      )}

      <div className="p-3 border-b border-fp-border">
        <div className="text-xs text-fp-muted mb-2 uppercase tracking-wide">Frequencies</div>
        {airport.frequencies && airport.frequencies.length > 0 ? (
          <div className="space-y-1">
            {airport.frequencies.map(freq => (
              <div key={freq.id} className="flex items-center gap-2 text-xs">
                <span className="text-fp-muted w-20 flex-shrink-0">{freq.frequencyType}</span>
                <span className="text-fp-accent font-mono font-semibold">{freq.frequencyMhz?.toFixed(3)}</span>
                {freq.name && <span className="text-fp-muted truncate">{freq.name}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-fp-muted text-xs">No frequencies available</div>
        )}
      </div>

      {localAirspaces.length > 0 && (
        <div className="p-3 border-b border-fp-border">
          <div className="text-xs text-fp-muted mb-2 uppercase tracking-wide">Airspace</div>
          <div className="space-y-1">
            {localAirspaces.map(a => (
              <div key={a.id} className="flex items-start gap-2 text-xs">
                <span className={`font-mono font-bold flex-shrink-0 ${AIRSPACE_CLASS_COLOR[a.airspaceClass] || 'text-fp-muted'}`}>
                  {a.airspaceClass}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-fp-text">{a.name}</span>
                  <span className="text-fp-muted">{formatAlt(a.lowerLimitFt, a.lowerLimitRef)} – {formatAlt(a.upperLimitFt, a.upperLimitRef)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {airport.icaoCode && (
        <div className="p-3 border-b border-fp-border">
          <div className="text-xs text-fp-muted mb-2 uppercase tracking-wide">NOTAMs</div>
          <NotamsSection country={airport.country} icao={airport.icaoCode} />
        </div>
      )}

      {airport.country === 'CZ' && airport.icaoCode && (
        <div className="p-3">
          <div className="text-xs text-fp-muted mb-2 uppercase tracking-wide">Charts</div>
          <a
            href={`https://aim.rlp.cz/vfrmanual/actual/${airport.icaoCode.toLowerCase()}_text_en.html`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-fp-accent hover:underline"
          >
            VFR Manual — {airport.icaoCode}
          </a>
        </div>
      )}
    </div>
  )
}
