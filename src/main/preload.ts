import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Screenshot operations
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  captureRegion: (x: number, y: number, width: number, height: number) =>
    ipcRenderer.invoke('capture-region', x, y, width, height),
  onScreenshotRequested: (callback: () => void) => {
    ipcRenderer.on('capture-screenshot-requested', callback)
  },

  // Export operations
  exportConversation: (messages: unknown, title: string, options: unknown) =>
    ipcRenderer.invoke('export-conversation', messages, title, options),
  openExportFolder: () => ipcRenderer.invoke('open-export-folder'),

  // AI operations
  sendAIResponse: (data: unknown) => ipcRenderer.send('ai-response', data),
  onTranslateRequested: (callback: () => void) => {
    ipcRenderer.on('translate-text-requested', callback)
  },
  onRecordingRequested: (callback: () => void) => {
    ipcRenderer.on('toggle-recording-requested', callback)
  },

  // Overlay control
  toggleMouseEvents: (ignore: boolean) => ipcRenderer.send('toggle-mouse-events', ignore),
  getOverlayState: () => ipcRenderer.invoke('get-overlay-state'),
  onOverlayToggled: (callback: (isVisible: boolean) => void) => {
    ipcRenderer.on('overlay-toggled', (_, isVisible) => callback(isVisible))
  },
  
  // Content Protection (visibilidade em capturas de tela)
  // enabled=true: janela OCULTA em screenshots/screen sharing (padrão)
  // enabled=false: janela VISÍVEL em screenshots/screen sharing
  setContentProtection: (enabled: boolean) => ipcRenderer.send('set-content-protection', enabled),

  // Display/Monitor operations
  getAllDisplays: () => ipcRenderer.invoke('get-all-displays'),
  getDisplayBounds: () => ipcRenderer.invoke('get-display-bounds'),
  moveWindowToDisplay: (overlayX: number, overlayY: number) => ipcRenderer.send('move-window-to-display', overlayX, overlayY),

  // Database - Conversations
  dbGetConversations: () => ipcRenderer.invoke('db-get-conversations'),
  dbGetConversation: (id: string) => ipcRenderer.invoke('db-get-conversation', id),
  dbCreateConversation: (title: string) => ipcRenderer.invoke('db-create-conversation', title),
  dbUpdateConversation: (id: string, updates: { title?: string }) => 
    ipcRenderer.invoke('db-update-conversation', id, updates),
  dbDeleteConversation: (id: string) => ipcRenderer.invoke('db-delete-conversation', id),

  // Database - Messages
  dbGetMessages: (conversationId: string) => ipcRenderer.invoke('db-get-messages', conversationId),
  dbAddMessage: (conversationId: string, role: string, content: string, metadata?: MessageMetadata) =>
    ipcRenderer.invoke('db-add-message', conversationId, role, content, metadata),
  dbDeleteMessage: (id: string) => ipcRenderer.invoke('db-delete-message', id),
  dbUpdateMessageMetadata: (messageId: string, metadata: MessageMetadata) =>
    ipcRenderer.invoke('db-update-message-metadata', messageId, metadata),

  // Database - Settings
  dbGetSetting: (key: string) => ipcRenderer.invoke('db-get-setting', key),
  dbGetAllSettings: () => ipcRenderer.invoke('db-get-all-settings'),
  dbSetSetting: (key: string, value: string) => ipcRenderer.invoke('db-set-setting', key, value),

  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('capture-screenshot-requested')
    ipcRenderer.removeAllListeners('translate-text-requested')
    ipcRenderer.removeAllListeners('toggle-recording-requested')
    ipcRenderer.removeAllListeners('overlay-toggled')
  },
})

// Tipos para o TypeScript
export interface Conversation {
  id: string
  title: string
  created_at: number
  updated_at: number
}

export interface MessageMetadata {
  tokens?: number           // Tokens usados nesta mensagem
  promptTokens?: number     // Tokens de entrada (para respostas da IA)
  completionTokens?: number // Tokens de saída (para respostas da IA)
  cost?: number             // Custo em USD
  model?: string            // Modelo usado
  audioDuration?: number    // Duração do áudio em segundos (se aplicável)
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: number
  metadata?: MessageMetadata
}

export interface DisplayInfo {
  id: number
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
  rotation: number
  touchSupport: 'available' | 'unavailable' | 'unknown'
  monochrome: boolean
  accelerometerSupport: 'available' | 'unavailable' | 'unknown'
  colorSpace: string
  colorDepth: number
  depthPerComponent: number
  displayFrequency: number
  size: {
    width: number
    height: number
  }
  workAreaSize: {
    width: number
    height: number
  }
  internal: boolean
}

export interface DisplayBounds {
  totalBounds: {
    x: number
    y: number
    width: number
    height: number
  }
  displays: DisplayInfo[]
}

declare global {
  interface Window {
    electronAPI: {
      // Screenshot
      captureScreenshot: () => Promise<string>
      captureRegion: (x: number, y: number, width: number, height: number) => Promise<string>
      onScreenshotRequested: (callback: () => void) => void
      
      // Export
      exportConversation: (messages: unknown, title: string, options: unknown) => Promise<string>
      openExportFolder: () => Promise<boolean>
      
      // AI
      sendAIResponse: (data: unknown) => void
      onTranslateRequested: (callback: () => void) => void
      onRecordingRequested: (callback: () => void) => void
      
      // Overlay
      toggleMouseEvents: (ignore: boolean) => void
      getOverlayState: () => Promise<{ isVisible: boolean; hotkeys: Record<string, string> }>
      onOverlayToggled: (callback: (isVisible: boolean) => void) => void
      
      // Content Protection (visibilidade em capturas de tela)
      setContentProtection: (enabled: boolean) => void
      
      // Display/Monitor operations
      getAllDisplays: () => Promise<DisplayInfo[]>
      getDisplayBounds: () => Promise<DisplayBounds>
      moveWindowToDisplay: (overlayX: number, overlayY: number) => void
      
      // Database - Conversations
      dbGetConversations: () => Promise<Conversation[]>
      dbGetConversation: (id: string) => Promise<Conversation | undefined>
      dbCreateConversation: (title: string) => Promise<Conversation>
      dbUpdateConversation: (id: string, updates: { title?: string }) => Promise<boolean>
      dbDeleteConversation: (id: string) => Promise<boolean>
      
      // Database - Messages
      dbGetMessages: (conversationId: string) => Promise<Message[]>
      dbAddMessage: (conversationId: string, role: string, content: string, metadata?: MessageMetadata) => Promise<Message>
      dbDeleteMessage: (id: string) => Promise<boolean>
      dbUpdateMessageMetadata: (messageId: string, metadata: MessageMetadata) => Promise<boolean>
      
      // Database - Settings
      dbGetSetting: (key: string) => Promise<string | null>
      dbGetAllSettings: () => Promise<Record<string, string>>
      dbSetSetting: (key: string, value: string) => Promise<boolean>
      
      // Cleanup
      removeAllListeners: () => void
    }
  }
}
