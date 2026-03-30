import { useEffect } from 'react'
import { useUiStore } from '../store/uiStore'

const TUTORIAL_DONE_KEY = 'vfr_tutorial_done'

export function useTutorialAutoStart() {
  const startTutorial = useUiStore(s => s.startTutorial)

  useEffect(() => {
    if (!localStorage.getItem(TUTORIAL_DONE_KEY)) {
      const id = setTimeout(startTutorial, 800)
      return () => clearTimeout(id)
    }
  }, [])
}
