export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ScreenshotData {
  timestamp: number
  data: string
  width: number
  height: number
}

export interface AIResponse {
  id: string
  content: string
  timestamp: number
  isStreaming: boolean
}

export interface AppConfig {
  apiKey: string
  model: 'gpt-4-vision' | 'gpt-4' | 'gpt-3.5-turbo'
  language: 'en' | 'pt'
  hotkeys: {
    toggleOverlay: string
    captureScreenshot: string
    translateText: string
  }
}
