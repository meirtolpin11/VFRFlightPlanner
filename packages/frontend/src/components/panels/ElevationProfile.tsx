import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Leg, AltitudePoint } from '@flight-planner/shared'
import { api } from '../../services/api'
import { haversineNm } from '../../utils/legCalc'
import { useTripStore } from '../../store/tripStore'
import { useMapStore } from '../../store/mapStore'

const NUM_SAMPLES = 80          // used for elevation API (URL length limited)
const NUM_AIRSPACE_SAMPLES = 400 // denser sampling for polygon intersection — pure client-side
const ML = 52  // margin left (alt labels)
const MR = 16  // margin right
const MT = 14  // margin top
const MB = 40  // margin bottom (waypoint labels)

const AIRSPACE_STROKE: Record<string, string> = {
  A: '#ff2222', B: '#0055ff', C: '#0055ff', D: '#0077dd',
  E: '#aa00cc', F: '#888888', G: '#aaaaaa',
}

// OpenAIP airspace type numbers for special-use airspace
const AIRSPACE_TYPE_RESTRICTED = 1
const AIRSPACE_TYPE_DANGER     = 2
const AIRSPACE_TYPE_PROHIBITED = 3
const AIRSPACE_TYPE_TSA        = 9  // Temporary Segregated Area (military training)

function airspaceColor(a: { airspaceClass: string; airspaceType: number }): string {
  if (a.airspaceType === AIRSPACE_TYPE_PROHIBITED) return '#ff2222'
  if (a.airspaceType === AIRSPACE_TYPE_RESTRICTED) return '#ff6600'
  if (a.airspaceType === AIRSPACE_TYPE_TSA)        return '#ff6600'
  if (a.airspaceType === AIRSPACE_TYPE_DANGER)     return '#ff9900'
  return AIRSPACE_STROKE[a.airspaceClass] ?? '#888888'
}

function airspaceLabel(a: { airspaceClass: string; airspaceType: number }): string {
  if (a.airspaceType === AIRSPACE_TYPE_PROHIBITED) return 'P'
  if (a.airspaceType === AIRSPACE_TYPE_RESTRICTED) return 'R'
  if (a.airspaceType === AIRSPACE_TYPE_TSA)        return 'TSA'
  if (a.airspaceType === AIRSPACE_TYPE_DANGER)     return 'D'
  return a.airspaceClass
}

function isSpecialAirspace(airspaceType: number): boolean {
  return airspaceType === AIRSPACE_TYPE_RESTRICTED
    || airspaceType === AIRSPACE_TYPE_DANGER
    || airspaceType === AIRSPACE_TYPE_PROHIBITED
    || airspaceType === AIRSPACE_TYPE_TSA
}

interface Sample { lat: number; lon: number; distNm: number }

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function sampleRoute(leg: Leg, n: number): Sample[] {
  const wps = [leg.departure, ...(leg.intermediates ?? []), leg.arrival].filter(Boolean)
  if (wps.length < 2) return []
  const segs: { fromNm: number; toNm: number; i: number }[] = []
  let total = 0
  for (let i = 0; i < wps.length - 1; i++) {
    const d = haversineNm(wps[i].lat, wps[i].lon, wps[i + 1].lat, wps[i + 1].lon)
    segs.push({ fromNm: total, toNm: total + d, i })
    total += d
  }
  const points: Sample[] = []
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total
    const s = segs.find(sg => sg.toNm >= target) ?? segs[segs.length - 1]
    const segLen = s.toNm - s.fromNm
    const t = segLen > 0 ? (target - s.fromNm) / segLen : 0
    points.push({
      lat: lerp(wps[s.i].lat, wps[s.i + 1].lat, t),
      lon: lerp(wps[s.i].lon, wps[s.i + 1].lon, t),
      distNm: target,
    })
  }
  return points
}

function pointInPolygon(lat: number, lon: number, coords: number[][]): boolean {
  let inside = false
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1], xj = coords[j][0], yj = coords[j][1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distNmToLatLon(distNm: number, samples: Sample[]): { lat: number; lon: number } {
  if (samples.length === 0) return { lat: 0, lon: 0 }
  if (distNm <= samples[0].distNm) return samples[0]
  if (distNm >= samples[samples.length - 1].distNm) return samples[samples.length - 1]
  const idx = samples.findIndex(s => s.distNm >= distNm)
  if (idx <= 0) return samples[0]
  const a = samples[idx - 1], b = samples[idx]
  const t = (distNm - a.distNm) / (b.distNm - a.distNm)
  return { lat: lerp(a.lat, b.lat, t), lon: lerp(a.lon, b.lon, t) }
}

function interpolateAlt(distNm: number, profile: AltitudePoint[]): number | null {
  if (profile.length === 0) return null
  if (profile.length === 1) return profile[0].altFt
  if (distNm <= profile[0].distNm) return profile[0].altFt
  if (distNm >= profile[profile.length - 1].distNm) return profile[profile.length - 1].altFt
  for (let i = 0; i < profile.length - 1; i++) {
    if (distNm >= profile[i].distNm && distNm <= profile[i + 1].distNm) {
      const t = (distNm - profile[i].distNm) / (profile[i + 1].distNm - profile[i].distNm)
      return lerp(profile[i].altFt, profile[i + 1].altFt, t)
    }
  }
  return null
}

function altTicks(maxAlt: number): number[] {
  const step = maxAlt <= 6000 ? 1000 : maxAlt <= 14000 ? 2000 : 5000
  const ticks: number[] = []
  for (let ft = 0; ft <= maxAlt; ft += step) ticks.push(ft)
  return ticks
}

export default function ElevationProfile({ leg, flightId }: { leg: Leg; flightId: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 800, h: 220 })
  const [localProfile, setLocalProfile] = useState<AltitudePoint[]>([])
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { updateLeg } = useTripStore()
  const flyTo = useMapStore(s => s.flyTo)

  // Track dims
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([e]) => setDims({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Sync profile from leg
  useEffect(() => {
    setLocalProfile(leg.altitudeProfile ?? [])
  }, [leg.id, leg.altitudeProfile])

  const depId = leg.departure?.id
  const arrId = leg.arrival?.id
  const intIds = leg.intermediates?.map(i => i.id).join(',') ?? ''

  const samples = useMemo(() => sampleRoute(leg, NUM_SAMPLES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leg.id, depId, arrId, intIds])

  // Denser samples only for airspace polygon intersection — no API calls, pure client-side
  const airspaceSamples = useMemo(() => sampleRoute(leg, NUM_AIRSPACE_SAMPLES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leg.id, depId, arrId, intIds])

  const bbox = useMemo(() => {
    if (samples.length === 0) return null
    const pad = 0.3
    const lats = samples.map(s => s.lat), lons = samples.map(s => s.lon)
    return `${(Math.min(...lons) - pad).toFixed(4)},${(Math.min(...lats) - pad).toFixed(4)},${(Math.max(...lons) + pad).toFixed(4)},${(Math.max(...lats) + pad).toFixed(4)}`
  }, [samples])

  const { data: elevations, isLoading: loadingElev } = useQuery({
    queryKey: ['elevation-profile', leg.id, depId, arrId, intIds],
    queryFn: async () => {
      const lats = samples.map(s => s.lat.toFixed(5)).join(',')
      const lons = samples.map(s => s.lon.toFixed(5)).join(',')
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`)
      const data = await res.json()
      return (data.elevation as number[]).map((m: number) => Math.round(m * 3.28084))
    },
    enabled: samples.length > 1,
    staleTime: Infinity,
  })

  const { data: airspaces } = useQuery({
    queryKey: ['airspaces-profile', bbox],
    queryFn: () => api.getAirspaces(bbox!),
    enabled: !!bbox,
    staleTime: 5 * 60 * 1000,
  })

  const airspaceRanges = useMemo(() => {
    if (!airspaces || airspaceSamples.length === 0) return []
    const map = new Map<string, { airspace: typeof airspaces[0]; minDist: number; maxDist: number }>()
    for (const s of airspaceSamples) {
      for (const a of airspaces) {
        if (!a.boundary?.coordinates?.[0]) continue
        if (pointInPolygon(s.lat, s.lon, a.boundary.coordinates[0])) {
          const cur = map.get(a.id)
          if (!cur) map.set(a.id, { airspace: a, minDist: s.distNm, maxDist: s.distNm })
          else cur.maxDist = s.distNm
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.airspace.lowerLimitFt - a.airspace.lowerLimitFt)
  }, [airspaces, airspaceSamples])

  const totalNm = samples.length > 0 ? samples[samples.length - 1].distNm : 1
  const maxTerrain = elevations ? Math.max(...elevations) : 3000
  const chartMaxAlt = Math.max(Math.ceil((maxTerrain + 2500) / 1000) * 1000, 10000)

  const cw = dims.w - ML - MR
  const ch = dims.h - MT - MB

  const xs = (nm: number) => (nm / totalNm) * cw
  const ys = (ft: number) => ch - Math.min(Math.max(ft, 0) / chartMaxAlt, 1) * ch

  // Convert mouse → chart coordinates
  const mouseToChart = useCallback((e: MouseEvent | React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left - ML
    const my = e.clientY - rect.top - MT
    const distNm = Math.max(0, Math.min(totalNm, (mx / cw) * totalNm))
    const altFt = Math.round(Math.max(0, Math.min(chartMaxAlt, (1 - my / ch) * chartMaxAlt)) / 100) * 100
    return { distNm, altFt }
  }, [cw, ch, totalNm, chartMaxAlt])

  // Save (debounced)
  const scheduleSave = useCallback((profile: AltitudePoint[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateLeg(flightId, leg.id, { altitudeProfile: profile } as any)
    }, 600)
  }, [flightId, leg.id, updateLeg])

  // Click on chart background → add point
  const handleChartClick = useCallback((e: React.MouseEvent) => {
    if (draggingIdx !== null) return
    const { distNm, altFt } = mouseToChart(e)
    const sorted = [...localProfile, { distNm, altFt }].sort((a, b) => a.distNm - b.distNm)
    setLocalProfile(sorted)
    scheduleSave(sorted)
  }, [draggingIdx, localProfile, mouseToChart, scheduleSave])

  // Mousedown on an altitude point → drag it
  const handlePointMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation()
    e.preventDefault()
    setDraggingIdx(idx)

    const onMove = (ev: MouseEvent) => {
      const { distNm, altFt } = mouseToChart(ev)
      setLocalProfile(prev => {
        const next = [...prev]
        const minDist = idx === 0 ? 0 : next[idx - 1].distNm + 0.2
        const maxDist = idx === next.length - 1 ? totalNm : next[idx + 1].distNm - 0.2
        next[idx] = { distNm: Math.max(minDist, Math.min(maxDist, distNm)), altFt }
        return next
      })
    }

    const onUp = () => {
      setDraggingIdx(null)
      setLocalProfile(prev => { scheduleSave(prev); return prev })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [mouseToChart, totalNm, scheduleSave])

  // Waypoint positions
  const wps = [leg.departure, ...(leg.intermediates ?? []), leg.arrival].filter(Boolean)
  let cumNm = 0
  const wpPos: { label: string; nm: number }[] = [{ label: wps[0]?.icaoCode || wps[0]?.name || '', nm: 0 }]
  for (let i = 1; i < wps.length; i++) {
    cumNm += haversineNm(wps[i - 1].lat, wps[i - 1].lon, wps[i].lat, wps[i].lon)
    wpPos.push({ label: wps[i]?.icaoCode || wps[i]?.name || '', nm: cumNm })
  }

  // Terrain path
  const terrainPath = elevations && samples.length > 1
    ? `M ${xs(samples[0].distNm).toFixed(1)},${ys(0).toFixed(1)} ` +
      samples.map((s, i) => `L ${xs(s.distNm).toFixed(1)},${ys(elevations[i]).toFixed(1)}`).join(' ') +
      ` L ${xs(samples[samples.length - 1].distNm).toFixed(1)},${ys(0).toFixed(1)} Z`
    : null

  // Altitude profile polyline
  const sortedProfile = [...localProfile].sort((a, b) => a.distNm - b.distNm)
  const altLinePts = sortedProfile.map(p => `${xs(p.distNm).toFixed(1)},${ys(p.altFt).toFixed(1)}`).join(' ')

  // Double-click on point → fly map to that location
  const handlePointDblClick = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation()
    const pt = sortedProfile[idx]
    const { lat, lon } = distNmToLatLon(pt.distNm, samples)
    flyTo(lat, lon, 11)
  }, [sortedProfile, samples, flyTo])

  // ✕ button click → remove point
  const handleDeletePoint = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation()
    const next = localProfile.filter((_, i) => i !== idx)
    setLocalProfile(next)
    scheduleSave(next)
  }, [localProfile, scheduleSave])

  // Terrain violation: segments where terrain > planned altitude
  const violationPath = useMemo(() => {
    if (!elevations || sortedProfile.length === 0) return null
    const segs: string[] = []
    let inViolation = false
    let segStart = ''
    for (let i = 0; i < samples.length; i++) {
      const planned = interpolateAlt(samples[i].distNm, sortedProfile)
      if (planned === null) continue
      const violated = elevations[i] > planned
      const x = xs(samples[i].distNm).toFixed(1)
      const yTerrain = ys(elevations[i]).toFixed(1)
      const yPlanned = ys(planned).toFixed(1)
      if (violated && !inViolation) {
        inViolation = true
        segStart = `M ${x},${yPlanned} L ${x},${yTerrain}`
      } else if (violated) {
        segs.push(segStart + ` L ${x},${yTerrain} L ${x},${yPlanned} Z`)
        segStart = `M ${x},${yPlanned} L ${x},${yTerrain}`
      } else {
        inViolation = false
      }
    }
    return segs.join(' ') || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevations, sortedProfile, samples, cw, ch, totalNm, chartMaxAlt])

  const cursorStyle = draggingIdx !== null ? 'ns-resize' : 'crosshair'

  return (
    <div ref={containerRef} className="w-full h-full relative bg-fp-bg select-none">
      {loadingElev && (
        <div className="absolute inset-0 flex items-center justify-center text-fp-muted text-xs">
          Loading terrain data…
        </div>
      )}
      {!loadingElev && (
        <>
          {localProfile.length === 0 && (
            <div
              className="absolute pointer-events-none text-fp-muted text-xs"
              style={{ left: ML + cw / 2, top: MT + 8, transform: 'translateX(-50%)' }}
            >
              Click chart to plan altitude · Double-click point to focus map · Hover ✕ to remove
            </div>
          )}
          <svg
            ref={svgRef}
            width={dims.w}
            height={dims.h}
            className="block"
            style={{ cursor: cursorStyle }}
          >
            <defs>
              <linearGradient id="ep-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1c3a6e" />
                <stop offset="100%" stopColor="#2a5298" />
              </linearGradient>
              <linearGradient id="ep-terrain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a7c59" />
                <stop offset="50%" stopColor="#3a5e45" />
                <stop offset="100%" stopColor="#1e2d1f" />
              </linearGradient>
            </defs>

            <g transform={`translate(${ML},${MT})`}>
              {/* Sky / clickable background */}
              <rect x={0} y={0} width={cw} height={ch} fill="url(#ep-sky)"
                onClick={handleChartClick} style={{ cursor: 'crosshair' }} />

              {/* Y-axis grid + labels */}
              {altTicks(chartMaxAlt).map(ft => (
                <g key={ft}>
                  <line x1={0} y1={ys(ft)} x2={cw} y2={ys(ft)}
                    stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                  <text x={-5} y={ys(ft) + 3.5} textAnchor="end" fontSize={9} fill="#64748b">
                    {ft === 0 ? 'SFC' : `${ft >= 1000 ? `${ft / 1000}k` : ft}`}
                  </text>
                </g>
              ))}

              {/* Airspace rectangles */}
              {airspaceRanges.map(({ airspace, minDist, maxDist }) => {
                const col = airspaceColor(airspace)
                const label = airspaceLabel(airspace)
                const isSpecial = isSpecialAirspace(airspace.airspaceType)
                const x1 = xs(minDist), x2 = xs(maxDist)
                const y1 = ys(Math.min(airspace.upperLimitFt, chartMaxAlt))
                const y2 = ys(Math.max(airspace.lowerLimitFt, 0))
                const rw = x2 - x1
                if (rw < 2) return null
                return (
                  <g key={airspace.id} style={{ pointerEvents: 'none' }}>
                    <rect x={x1} y={y1} width={rw} height={y2 - y1}
                      fill={col} fillOpacity={isSpecial ? 0.22 : 0.13}
                      stroke={col} strokeWidth={isSpecial ? 1.8 : 1.2} strokeOpacity={0.75}
                      strokeDasharray={airspace.airspaceType === AIRSPACE_TYPE_RESTRICTED ? '4,3' : undefined} />
                    {rw > 20 && (
                      <text x={x1 + rw / 2} y={y1 + 11} textAnchor="middle"
                        fontSize={9} fill={col} fillOpacity={0.95} fontWeight="700">
                        {label}
                      </text>
                    )}
                    {rw > 55 && (
                      <text x={x1 + rw / 2} y={y1 + 21} textAnchor="middle"
                        fontSize={8} fill={col} fillOpacity={0.75}>
                        {airspace.name.length > 14 ? airspace.name.slice(0, 14) + '…' : airspace.name}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Terrain */}
              {terrainPath && (
                <path d={terrainPath} fill="url(#ep-terrain)" style={{ pointerEvents: 'none' }} />
              )}

              {/* Terrain violation (terrain above planned altitude) */}
              {violationPath && (
                <path d={violationPath} fill="rgba(239,68,68,0.45)"
                  stroke="#ef4444" strokeWidth={0.5} style={{ pointerEvents: 'none' }} />
              )}

              {/* Altitude profile line */}
              {sortedProfile.length >= 2 && (
                <polyline
                  points={altLinePts}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {sortedProfile.length === 1 && (
                <line
                  x1={0} y1={ys(sortedProfile[0].altFt)}
                  x2={cw} y2={ys(sortedProfile[0].altFt)}
                  stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="6,4"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Altitude profile handles */}
              {sortedProfile.map((pt, idx) => {
                const px = xs(pt.distNm)
                const py = ys(pt.altFt)
                const isActive = draggingIdx === idx || hoverIdx === idx
                return (
                  <g key={idx}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    {/* Invisible hit area covering circle + label + delete button */}
                    <rect
                      x={px - 16} y={py - 40} width={32} height={48}
                      fill="transparent"
                      onMouseDown={e => handlePointMouseDown(e, idx)}
                      onDoubleClick={e => handlePointDblClick(e, idx)}
                      style={{ cursor: 'move' }}
                    />
                    <circle cx={px} cy={py} r={isActive ? 8 : 6}
                      fill={isActive ? '#fbbf24' : '#1c3a6e'}
                      stroke="#fbbf24" strokeWidth={2}
                      onMouseDown={e => handlePointMouseDown(e, idx)}
                      onDoubleClick={e => handlePointDblClick(e, idx)}
                      style={{ cursor: 'move', pointerEvents: 'none' }}
                    />
                    {isActive && (
                      <text x={px} y={py - 11} textAnchor="middle"
                        fontSize={9} fontWeight="700" fill="#fbbf24"
                        style={{ pointerEvents: 'none' }}>
                        {Math.round(pt.altFt / 100) * 100} ft
                      </text>
                    )}
                    {/* Delete button — visible on hover */}
                    {isActive && (
                      <g onClick={e => handleDeletePoint(e, idx)} onDoubleClick={e => e.stopPropagation()} style={{ cursor: 'pointer' }}>
                        <circle cx={px} cy={py - 28} r={7} fill="#ef4444" fillOpacity={0.9} />
                        <text x={px} y={py - 24.5} textAnchor="middle"
                          fontSize={9} fontWeight="700" fill="white" style={{ pointerEvents: 'none' }}>
                          ✕
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}

              {/* Waypoint verticals + labels */}
              {wpPos.map((wp, i) => {
                const x = xs(wp.nm)
                const isFirst = i === 0, isLast = i === wpPos.length - 1
                return (
                  <g key={i} style={{ pointerEvents: 'none' }}>
                    <line x1={x} y1={0} x2={x} y2={ch}
                      stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="3,3" />
                    <circle cx={x} cy={ch} r={3} fill="#e2e8f0" />
                    <text x={x} y={ch + 14}
                      textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                      fontSize={10} fontWeight="600" fill="#cbd5e1">
                      {wp.label}
                    </text>
                    <text x={x} y={ch + 26}
                      textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                      fontSize={8} fill="#475569">
                      {wp.nm.toFixed(0)} NM
                    </text>
                  </g>
                )
              })}

              {/* Chart border */}
              <rect x={0} y={0} width={cw} height={ch}
                fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1}
                style={{ pointerEvents: 'none' }} />
            </g>
          </svg>
        </>
      )}
    </div>
  )
}
