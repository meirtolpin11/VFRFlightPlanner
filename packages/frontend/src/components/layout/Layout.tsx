import { useEffect, useRef, useState, useCallback } from 'react'
import TopToolbar from './TopToolbar'
import LeftSidebar from './LeftSidebar'
import RightPanel from './RightPanel'
import BottomStrip from './BottomStrip'
import MapView from '../map/MapView'
import ElevationProfile from '../panels/ElevationProfile'
import { useTripStore } from '../../store/tripStore'
import { useAirplaneStore } from '../../store/airplaneStore'
import { useSelectionStore } from '../../store/selectionStore'
import CreateTripModal from '../modals/CreateTripModal'
import CreateFlightModal from '../modals/CreateFlightModal'
import CreateLegModal from '../modals/CreateLegModal'
import AirplaneProfilesModal from '../modals/AirplaneProfilesModal'
import ExportModal from '../modals/ExportModal'
import TutorialOverlay from '../tutorial/TutorialOverlay'
import { useTutorialAutoStart } from '../../hooks/useTutorialAutoStart'

const MIN_PANEL = 160
const MAX_PANEL = 520
const MIN_PROFILE = 140
const MAX_PROFILE = 480

function useHResize(initial: number, side: 'left' | 'right') {
  const [width, setWidth] = useState(initial)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = side === 'left' ? ev.clientX - startX.current : startX.current - ev.clientX
      setWidth(Math.min(MAX_PANEL, Math.max(MIN_PANEL, startW.current + delta)))
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width, side])

  return { width, onMouseDown }
}

function useVResize(initial: number) {
  const [height, setHeight] = useState(initial)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startH.current = height
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      // dragging up = panel grows (startY - ev.clientY is positive)
      const delta = startY.current - ev.clientY
      setHeight(Math.min(MAX_PROFILE, Math.max(MIN_PROFILE, startH.current + delta)))
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [height])

  return { height, onMouseDown }
}

export default function Layout() {
  const fetchTrips = useTripStore(s => s.fetchTrips)
  const fetchAirplanes = useAirplaneStore(s => s.fetchAirplanes)
  const { legId, flightId } = useSelectionStore()

  const left = useHResize(256, 'left')
  const right = useHResize(288, 'right')
  const profile = useVResize(220)

  // Subscribe directly to trips so selectedLeg updates when waypoints change
  const selectedLeg = useTripStore(s => {
    if (!legId) return null
    for (const t of s.trips) {
      for (const f of t.flights) {
        const l = f.legs.find(l => l.id === legId)
        if (l) return l
      }
    }
    return null
  })
  const showProfile = !!(selectedLeg?.departure && selectedLeg?.arrival)

  useTutorialAutoStart()

  useEffect(() => {
    fetchTrips()
    fetchAirplanes()
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-fp-bg text-fp-text">
      <TopToolbar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div style={{ width: left.width, minWidth: left.width }} className="flex flex-col overflow-hidden">
          <LeftSidebar />
        </div>

        {/* Left resize handle */}
        <div
          onMouseDown={left.onMouseDown}
          className="w-1 flex-shrink-0 bg-fp-border hover:bg-fp-accent cursor-col-resize transition-colors relative"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Center column: map + optional profile */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div data-tutorial="map-area" className="flex-1 relative overflow-hidden min-h-0">
            <MapView />
          </div>

          {showProfile && (
            <>
              {/* Profile resize handle */}
              <div
                onMouseDown={profile.onMouseDown}
                className="h-1 flex-shrink-0 bg-fp-border hover:bg-fp-accent cursor-row-resize transition-colors relative"
              >
                <div className="absolute inset-x-0 -top-1 -bottom-1" />
              </div>

              {/* Elevation profile panel */}
              <div
                style={{ height: profile.height, minHeight: profile.height }}
                className="flex-shrink-0 overflow-hidden border-t border-fp-border bg-fp-bg"
              >
                <ElevationProfile leg={selectedLeg!} flightId={flightId!} />
              </div>
            </>
          )}
        </div>

        {/* Right resize handle */}
        <div
          onMouseDown={right.onMouseDown}
          className="w-1 flex-shrink-0 bg-fp-border hover:bg-fp-accent cursor-col-resize transition-colors relative"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right panel */}
        <div style={{ width: right.width, minWidth: right.width }} className="flex flex-col overflow-hidden">
          <RightPanel />
        </div>
      </div>

      <BottomStrip />

      <CreateTripModal />
      <CreateFlightModal />
      <CreateLegModal />
      <AirplaneProfilesModal />
      <ExportModal />
      <TutorialOverlay />
    </div>
  )
}
