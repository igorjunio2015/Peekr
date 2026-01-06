import { globalShortcut } from 'electron'

export interface HotkeyConfig {
  toggleOverlay: string
  captureScreenshot: string
  translateText: string
  toggleRecording: string
}

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  toggleOverlay: 'Control+Alt+A',
  captureScreenshot: 'Control+Alt+S',
  translateText: 'Control+Alt+T',
  toggleRecording: 'Control+Alt+R',
}

export class HotkeyManager {
  private registeredHotkeys: Map<string, string> = new Map()

  constructor() {
    // HotkeyManager initialized
  }

  registerHotkeys(
    config: HotkeyConfig,
    callbacks: {
      onToggleOverlay: () => void
      onCaptureScreenshot: () => void
      onTranslateText: () => void
      onToggleRecording?: () => void
    }
  ): void {
    this.unregisterAll()

    try {
      globalShortcut.register(config.toggleOverlay, callbacks.onToggleOverlay)
      this.registeredHotkeys.set('toggleOverlay', config.toggleOverlay)

      globalShortcut.register(config.captureScreenshot, callbacks.onCaptureScreenshot)
      this.registeredHotkeys.set('captureScreenshot', config.captureScreenshot)

      globalShortcut.register(config.translateText, callbacks.onTranslateText)
      this.registeredHotkeys.set('translateText', config.translateText)

      if (callbacks.onToggleRecording) {
        globalShortcut.register(config.toggleRecording, callbacks.onToggleRecording)
        this.registeredHotkeys.set('toggleRecording', config.toggleRecording)
      }
    } catch (error) {
      console.error('Failed to register hotkeys:', error)
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
    this.registeredHotkeys.clear()
  }

  getRegisteredHotkeys(): HotkeyConfig {
    return {
      toggleOverlay: this.registeredHotkeys.get('toggleOverlay') || DEFAULT_HOTKEYS.toggleOverlay,
      captureScreenshot:
        this.registeredHotkeys.get('captureScreenshot') || DEFAULT_HOTKEYS.captureScreenshot,
      translateText: this.registeredHotkeys.get('translateText') || DEFAULT_HOTKEYS.translateText,
      toggleRecording: this.registeredHotkeys.get('toggleRecording') || DEFAULT_HOTKEYS.toggleRecording,
    }
  }
}
