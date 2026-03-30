import { Joyride, STATUS } from 'react-joyride'
import type { BeaconRenderProps, EventData, Step } from 'react-joyride'
import { useUiStore } from '../../store/uiStore'

function RedBeacon(_props: BeaconRenderProps) {
  return (
    <span style={{ width: 28, height: 28, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: 'rgba(239,68,68,0.25)',
        animation: 'beacon-pulse 1.4s ease-in-out infinite',
      }} />
      <span style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#ef4444',
        boxShadow: '0 0 8px rgba(239,68,68,0.7)',
        position: 'relative',
      }} />
      <style>{`
        @keyframes beacon-pulse {
          0%   { transform: scale(0.8); opacity: 0.9; }
          50%  { transform: scale(1.4); opacity: 0.3; }
          100% { transform: scale(0.8); opacity: 0.9; }
        }
      `}</style>
    </span>
  )
}

const TUTORIAL_DONE_KEY = 'vfr_tutorial_done'

const STEPS: Step[] = [
  {
    target: '[data-tutorial="toolbar-layers-base"]',
    title: 'Map base layers',
    content: 'Toggle between the standard base map and the aeronautical chart overlay. "Base" is the OSM street map; "Aero" shows the VFR aviation chart.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="toolbar-layers-overlays"]',
    title: 'Overlay toggles',
    content: 'Switch individual overlays on/off: Airspaces, Airports, Visual Reporting Points (VRPs), Navaids, Wind arrows, and GAFOR area weather.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="toolbar-search"]',
    title: 'Airport search',
    content: 'Type an ICAO code or airport name and press Enter to fly the map to that location.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="toolbar-new-trip"]',
    title: 'Create a trip',
    content: 'A Trip is the top-level container for your planning. Click here to create one — trips hold one or more Flights.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="sidebar-trips"]',
    title: 'Trips & flights',
    content: 'All your trips live here. Expand a trip to see its Flights, and expand a flight to see its Legs — individual point-to-point route segments.',
    placement: 'right',
  },
  {
    target: '[data-tutorial="sidebar-add-flight"]',
    title: 'Add a flight',
    content: 'Click "+ Flight" on a trip to create a flight. Assign an airplane profile to enable ETE and fuel burn calculations.',
    placement: 'right',
  },
  {
    target: '[data-tutorial="sidebar-add-leg"]',
    title: 'Add a leg',
    content: 'Click "+" on a flight to open the leg builder. Select a departure and arrival airport — you can also click intermediate waypoints on the map.',
    placement: 'right',
  },
  {
    target: '[data-tutorial="leg-color-dot"]',
    title: 'Change leg color',
    content: 'Click the colored dot next to a leg to open the color picker. Choose from the palette or pick any custom color — the route line on the map updates instantly.',
    placement: 'right',
  },
  {
    target: '[data-tutorial="leg-visibility"]',
    title: 'Show / hide a leg',
    content: 'Click the ● button to hide a leg from the map without deleting it. Click ○ to show it again. Hover over the leg row to reveal this button.',
    placement: 'right',
  },
  {
    target: '[data-tutorial="right-panel"]',
    title: 'Leg detail panel',
    content: 'Select a leg to open this panel. Here you can view all waypoints, add notes, and export the navlog as GPX, PLN, or FPL.',
    placement: 'left',
  },
  {
    target: '[data-tutorial="bottom-strip"]',
    title: 'Flight stats',
    content: 'When a leg is selected, this bar shows total distance in NM, estimated time en route (ETE), and fuel burn — all calculated from the assigned airplane profile.',
    placement: 'top',
  },
  {
    target: '[data-tutorial="map-area"]',
    title: 'Interactive map',
    content: 'Click any airport marker to open its detail panel: runways, frequencies, and elevation. Right-click anywhere on the map for the context menu.',
    placement: 'top',
  },
  {
    target: '[data-tutorial="toolbar-help"]',
    title: "You're all set!",
    content: 'You can replay this tutorial at any time by clicking the "?" button here.',
    placement: 'bottom',
  },
]

const joyrideOptions = {
  primaryColor: '#3b82f6',
  backgroundColor: '#161b27',
  textColor: '#e2e8f0',
  overlayColor: 'rgba(13,17,23,0.75)',
  arrowColor: '#161b27',
  zIndex: 10000,
}

export default function TutorialOverlay() {
  const tutorialActive = useUiStore(s => s.tutorialActive)
  const tutorialKey = useUiStore(s => s.tutorialKey)
  const stopTutorial = useUiStore(s => s.stopTutorial)

  function handleEvent(data: EventData) {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem(TUTORIAL_DONE_KEY, 'true')
      stopTutorial()
    }
  }

  return (
    <Joyride
      key={tutorialKey}
      steps={STEPS}
      run={tutorialActive}
      continuous
      scrollToFirstStep
      beaconComponent={RedBeacon}
      onEvent={handleEvent}
      options={joyrideOptions}
      locale={{
        back: '← Back',
        close: '✕',
        last: 'Finish',
        next: 'Next →',
        skip: 'Skip tour',
      }}
    />
  )
}
