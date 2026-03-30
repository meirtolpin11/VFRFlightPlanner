import { Fragment } from 'react'
import { Polyline, Tooltip } from 'react-leaflet'
import { useMapStore } from '../../store/mapStore'
import { GAFOR_ROUTES } from '../../data/gaforZones'

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#ef4444']

function elevColor(ft: number): string {
  if (ft <= 3000) return '#22c55e'   // green  — easy (up to ~900m)
  if (ft <= 5000) return '#f59e0b'   // amber  — moderate (up to ~1500m)
  if (ft <= 7000) return '#f97316'   // orange — high (up to ~2100m)
  return '#ef4444'                   // red    — very high (>2100m)
}

export default function GaforLayer() {
  const showGafor = useMapStore(s => s.showGafor)
  if (!showGafor) return null

  return (
    <>
      {GAFOR_ROUTES.map((route, i) => {
        const color = COLORS[i % COLORS.length]
        const elevM = Math.round(route.maxElevFt * 0.3048)
        const dot = elevColor(route.maxElevFt)
        return (
          <Fragment key={route.id}>
            {/* Dark outline for contrast against chart */}
            <Polyline
              positions={route.path}
              pathOptions={{ color: '#111827', weight: 7, opacity: 0.5 }}
              interactive={false}
            />
            {/* Colored route */}
            <Polyline
              positions={route.path}
              pathOptions={{ color, weight: 4, opacity: 1 }}
            >
              <Tooltip sticky>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{route.name}</div>
                  <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ color: '#6b7280', paddingRight: 8 }}>Min safe altitude</td>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dot, marginRight: 4, verticalAlign: 'middle' }} />
                          {route.maxElevFt.toLocaleString()} ft &nbsp;({elevM.toLocaleString()} m)
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: '#6b7280' }}>Route length</td>
                        <td style={{ fontWeight: 600 }}>{route.lengthNm} NM</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
                    Source: AIP Austria · &nbsp;
                    <a
                      href="http://www.hubair.de/gafor-routes-alps.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb' }}
                      onClick={e => e.stopPropagation()}
                    >
                      hubair.de
                    </a>
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          </Fragment>
        )
      })}
    </>
  )
}
