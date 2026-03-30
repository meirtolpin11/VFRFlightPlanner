import { useEffect, useState, useRef, useCallback } from 'react'
import { Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../../store/mapStore'

interface WindPoint {
  lat: number
  lon: number
  speedKt: number
  dirDeg: number
}

export const WIND_ALTITUDES = [
  { key: 'sfc',  label: 'SFC',      title: 'Surface (10 m AGL)' },
  { key: '925',  label: '2500 ft',  title: '925 hPa ≈ 2500 ft MSL' },
  { key: '850',  label: '5000 ft',  title: '850 hPa ≈ 5000 ft MSL' },
  { key: '700',  label: '10000 ft', title: '700 hPa ≈ 10000 ft MSL' },
]

function windArrowIcon(speedKt: number, dirDeg: number) {
  const rotDeg = (dirDeg + 180) % 360
  const color = speedKt < 8 ? '#86efac' : speedKt < 15 ? '#fbbf24' : speedKt < 25 ? '#f97316' : '#ef4444'
  const size = 48
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-24 -24 48 48">
    <g transform="rotate(${rotDeg})">
      <line x1="0" y1="14" x2="0" y2="-6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <polygon points="0,-18 -5,-7 5,-7" fill="${color}"/>
    </g>
    <text x="0" y="8" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="${color}" font-family="monospace" font-weight="bold">${Math.round(speedKt)}</text>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function makeGrid(s: number, n: number, w: number, e: number) {
  const pts: { lat: number; lon: number }[] = []
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++)
      pts.push({ lat: s + (n - s) * (r + 0.5) / 4, lon: w + (e - w) * (c + 0.5) / 5 })
  return pts
}

function currentHourIdx(times: string[]): number {
  const now = new Date()
  const p = (n: number) => n.toString().padStart(2, '0')
  const s = `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}T${p(now.getUTCHours())}:00`
  const i = times.indexOf(s)
  return i >= 0 ? i : 0
}

export default function WindLayer() {
  const showWind = useMapStore(s => s.showWind)
  const windAltitude = useMapStore(s => s.windAltitude)
  const [points, setPoints] = useState<WindPoint[]>([])
  const map = useMap()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchWind = useCallback(async (altitude: string) => {
    const b = map.getBounds()
    const grid = makeGrid(b.getSouth(), b.getNorth(), b.getWest(), b.getEast())
    const lats = grid.map(p => p.lat.toFixed(4)).join(',')
    const lons = grid.map(p => p.lon.toFixed(4)).join(',')

    let url: string
    if (altitude === 'sfc') {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=windspeed_10m,winddirection_10m&wind_speed_unit=kn`
    } else {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=windspeed_${altitude}hPa,winddirection_${altitude}hPa&wind_speed_unit=kn&forecast_days=1&timezone=UTC`
    }

    try {
      const res = await fetch(url)
      const data = await res.json()
      const arr: any[] = Array.isArray(data) ? data : [data]
      setPoints(arr.map((d, i) => {
        let speedKt = 0, dirDeg = 0
        if (altitude === 'sfc') {
          speedKt = d.current?.windspeed_10m ?? 0
          dirDeg = d.current?.winddirection_10m ?? 0
        } else {
          const times: string[] = d.hourly?.time ?? []
          const idx = currentHourIdx(times)
          speedKt = d.hourly?.[`windspeed_${altitude}hPa`]?.[idx] ?? 0
          dirDeg = d.hourly?.[`winddirection_${altitude}hPa`]?.[idx] ?? 0
        }
        return { lat: grid[i].lat, lon: grid[i].lon, speedKt, dirDeg }
      }))
    } catch (e) {
      console.error('Wind fetch failed', e)
    }
  }, [map])

  useEffect(() => {
    if (!showWind) { setPoints([]); return }
    fetchWind(windAltitude)
  }, [showWind, windAltitude, fetchWind])

  useMapEvents({
    moveend: () => {
      if (!showWind) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fetchWind(windAltitude), 600)
    },
  })

  if (!showWind || points.length === 0) return null

  return (
    <>
      {points.map((p, i) => (
        <Marker
          key={i}
          position={[p.lat, p.lon]}
          icon={windArrowIcon(p.speedKt, p.dirDeg)}
          interactive={false}
        />
      ))}
    </>
  )
}
