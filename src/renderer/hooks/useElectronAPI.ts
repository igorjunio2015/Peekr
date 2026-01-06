import { useEffect, useCallback, useState } from 'react'
import type { DisplayInfo, DisplayBounds } from '../../main/preload'

interface OverlayState {
  isVisible: boolean
  hotkeys: Record<string, string>
}

export const useElectronAPI = () => {
  const [overlayState, setOverlayState] = useState<OverlayState | null>(null)

  const captureScreenshot = useCallback(async () => {
    if (window.electronAPI) {
      return await window.electronAPI.captureScreenshot()
    }
    return null
  }, [])

  const captureRegion = useCallback(
    async (x: number, y: number, width: number, height: number) => {
      if (window.electronAPI) {
        return await window.electronAPI.captureRegion(x, y, width, height)
      }
      return null
    },
    []
  )

  const sendAIResponse = useCallback((data: unknown) => {
    if (window.electronAPI) {
      window.electronAPI.sendAIResponse(data)
    }
  }, [])

  const toggleMouseEvents = useCallback((ignore: boolean) => {
    if (window.electronAPI) {
      window.electronAPI.toggleMouseEvents(ignore)
    }
  }, [])

  const getOverlayState = useCallback(async () => {
    if (window.electronAPI) {
      const state = await window.electronAPI.getOverlayState()
      setOverlayState(state)
      return state
    }
    return null
  }, [])

  const onScreenshotRequested = useCallback((callback: () => void) => {
    if (window.electronAPI) {
      window.electronAPI.onScreenshotRequested(callback)
    }
  }, [])

  const onTranslateRequested = useCallback((callback: () => void) => {
    if (window.electronAPI) {
      window.electronAPI.onTranslateRequested(callback)
    }
  }, [])

  const onRecordingRequested = useCallback((callback: () => void) => {
    if (window.electronAPI) {
      window.electronAPI.onRecordingRequested(callback)
    }
  }, [])

  const onOverlayToggled = useCallback((callback: (isVisible: boolean) => void) => {
    if (window.electronAPI) {
      window.electronAPI.onOverlayToggled(callback)
    }
  }, [])

  const getAllDisplays = useCallback(async (): Promise<DisplayInfo[]> => {
    if (window.electronAPI) {
      return await window.electronAPI.getAllDisplays()
    }
    return []
  }, [])

  const getDisplayBounds = useCallback(async (): Promise<DisplayBounds | null> => {
    if (window.electronAPI) {
      return await window.electronAPI.getDisplayBounds()
    }
    return null
  }, [])

  const moveWindowToDisplay = useCallback((overlayX: number, overlayY: number) => {
    if (window.electronAPI) {
      window.electronAPI.moveWindowToDisplay(overlayX, overlayY)
    }
  }, [])

  const setContentProtection = useCallback((enabled: boolean) => {
    if (window.electronAPI) {
      window.electronAPI.setContentProtection(enabled)
    }
  }, [])

  useEffect(() => {
    getOverlayState()

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners()
      }
    }
  }, [getOverlayState])

  return {
    captureScreenshot,
    captureRegion,
    sendAIResponse,
    toggleMouseEvents,
    getOverlayState,
    onScreenshotRequested,
    onTranslateRequested,
    onRecordingRequested,
    onOverlayToggled,
    getAllDisplays,
    getDisplayBounds,
    moveWindowToDisplay,
    setContentProtection,
    overlayState,
  }
}
