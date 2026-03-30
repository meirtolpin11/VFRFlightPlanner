import { useState, useRef } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../services/api'
import AdminUsersModal from '../modals/AdminUsersModal'

function LayerBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium transition-all ${
        active
          ? 'bg-fp-accent text-white fp-glow'
          : 'text-fp-muted hover:text-fp-text hover:bg-fp-panel-2'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-fp-border-2 flex-shrink-0 mx-1" />
}

function PillGroup({ children, ...rest }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex items-center rounded-md border border-fp-border-2 overflow-hidden flex-shrink-0 bg-fp-panel" {...rest}>
      {children}
    </div>
  )
}

export default function TopToolbar() {
  const {
    showBaseLayer, showAeroLayer, showAirspaces, showAirports,
    showReportingPoints, showNavaids, showWind, showGafor,
    setShowBaseLayer, setShowAeroLayer, setShowAirspaces, setShowAirports,
    setShowReportingPoints, setShowNavaids, setShowWind, setShowGafor,
    flyTo,
  } = useMapStore()
  const { setCreateTripOpen, setAirplanesOpen, startTutorial } = useUiStore()
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const [adminOpen, setAdminOpen] = useState(false)

  // Airport search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  async function handleSearch() {
    const q = searchQuery.trim()
    if (!q) return
    setSearchError(null)
    setSearching(true)
    try {
      const results = await api.searchWaypoints(q)
      if (results.length === 0) {
        setSearchError('Not found')
        return
      }
      const wp = results[0]
      flyTo(wp.lat, wp.lon, 12)
      setSearchQuery('')
      searchInputRef.current?.blur()
    } catch {
      setSearchError('Search failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-fp-panel border-b border-fp-border-2 flex-shrink-0 overflow-x-auto">
      {/* Brand */}
      <span className="text-sm font-bold text-fp-accent mr-2 flex-shrink-0 tracking-tight">
        ✈ VFR Planner
      </span>

      {/* Pill group 1: Map base layers */}
      <PillGroup data-tutorial="toolbar-layers-base">
        <LayerBtn active={showBaseLayer} onClick={() => setShowBaseLayer(!showBaseLayer)}>Base</LayerBtn>
        <div className="w-px h-4 bg-fp-border-2" />
        <LayerBtn active={showAeroLayer} onClick={() => setShowAeroLayer(!showAeroLayer)}>Aero</LayerBtn>
      </PillGroup>

      <Divider />

      {/* Pill group 2: Overlay layers */}
      <PillGroup data-tutorial="toolbar-layers-overlays">
        <LayerBtn active={showAirspaces} onClick={() => setShowAirspaces(!showAirspaces)}>Airspaces</LayerBtn>
        <div className="w-px h-4 bg-fp-border-2" />
        <LayerBtn active={showAirports} onClick={() => setShowAirports(!showAirports)}>Airports</LayerBtn>
        <div className="w-px h-4 bg-fp-border-2" />
        <LayerBtn active={showReportingPoints} onClick={() => setShowReportingPoints(!showReportingPoints)}>VRPs</LayerBtn>
        <div className="w-px h-4 bg-fp-border-2" />
        <LayerBtn active={showNavaids} onClick={() => setShowNavaids(!showNavaids)}>NAV</LayerBtn>
        <div className="w-px h-4 bg-fp-border-2" />
        <LayerBtn active={showWind} onClick={() => setShowWind(!showWind)}>Wind</LayerBtn>
        <div className="w-px h-4 bg-fp-border-2" />
        <LayerBtn active={showGafor} onClick={() => setShowGafor(!showGafor)}>GAFOR</LayerBtn>
      </PillGroup>

      <Divider />

      {/* Airport / waypoint search */}
      <div className="relative flex-shrink-0" data-tutorial="toolbar-search">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchError(null) }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="ICAO / name…"
          className="w-36 bg-fp-bg border border-fp-border-2 rounded px-2.5 py-1 text-xs text-fp-text placeholder:text-fp-muted focus:outline-none focus:border-fp-accent transition-colors"
        />
        {searchError && (
          <span className="absolute left-0 top-full mt-1 text-xs text-fp-danger whitespace-nowrap bg-fp-panel border border-fp-border rounded px-2 py-0.5 z-10">
            {searchError}
          </span>
        )}
        {searching && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-fp-muted text-xs">…</span>
        )}
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <button
        data-tutorial="toolbar-new-trip"
        onClick={() => setCreateTripOpen(true)}
        className="px-3 py-1.5 bg-fp-accent text-white rounded text-xs font-semibold hover:bg-blue-400 transition-colors flex-shrink-0 fp-glow"
      >
        + New Trip
      </button>
      <button
        onClick={() => setAirplanesOpen(true)}
        className="px-3 py-1.5 bg-fp-panel-2 border border-fp-border-2 text-fp-muted-2 rounded text-xs font-medium hover:text-fp-text hover:border-fp-accent transition-colors flex-shrink-0"
      >
        ✈ Planes
      </button>

      <Divider />

      {/* Auth section */}
      {user && (
        <>
          <span className="text-xs text-fp-muted-2 flex-shrink-0">{user.username}</span>
          {user.role === 'admin' && (
            <button
              onClick={() => setAdminOpen(true)}
              className="px-3 py-1.5 bg-fp-panel-2 border border-fp-border-2 text-fp-muted-2 rounded text-xs font-medium hover:text-fp-text hover:border-fp-accent transition-colors flex-shrink-0"
            >
              Admin
            </button>
          )}
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 bg-fp-panel-2 border border-fp-border-2 text-fp-muted-2 rounded text-xs font-medium hover:text-fp-text hover:border-fp-danger transition-colors flex-shrink-0"
          >
            Logout
          </button>
          <button
            data-tutorial="toolbar-help"
            onClick={startTutorial}
            className="w-6 h-6 flex items-center justify-center rounded-full border border-fp-border-2 text-fp-muted text-xs font-bold hover:border-fp-accent hover:text-fp-accent transition-colors flex-shrink-0"
            title="Show tutorial"
          >?</button>
        </>
      )}

      <AdminUsersModal isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
    </div>
  )
}
