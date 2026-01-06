import { app, ipcMain, session, desktopCapturer } from 'electron'
import isDev from 'electron-is-dev'
import { WindowManager } from './window-manager'
import { HotkeyManager, DEFAULT_HOTKEYS } from './hotkeys'
import { ScreenshotService } from './screenshot-service'
import { ExportService, ExportOptions } from './export-service'
import { databaseService, Message, MessageMetadata } from './database-service'
import { AIMessage } from '../shared/types'

let windowManager: WindowManager
let hotkeyManager: HotkeyManager
let isOverlayVisible = true

const initializeApp = async () => {
  // Inicializar banco de dados
  await databaseService.initialize()

  windowManager = new WindowManager()
  const overlayWindow = windowManager.createOverlayWindow()
  hotkeyManager = new HotkeyManager()

  // Configurar handler para captura de áudio do sistema
  // Isso permite que getDisplayMedia capture áudio do sistema (loopback)
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Permitir captura da primeira tela com áudio do sistema (loopback)
      callback({ video: sources[0], audio: 'loopback' })
    }).catch((err) => {
      console.error('Erro ao obter sources para display media:', err)
      callback({ video: undefined, audio: undefined })
    })
  }, { useSystemPicker: false })

  windowManager.loadURL(overlayWindow, isDev)

  overlayWindow.on('closed', () => {
    windowManager.closeWindow('overlay')
  })

  setupHotkeys()
  setupIPC()
}

const setupHotkeys = () => {
  hotkeyManager.registerHotkeys(DEFAULT_HOTKEYS, {
    onToggleOverlay: () => {
      isOverlayVisible = windowManager.toggleVisibility('overlay')
      const window = windowManager.getWindow('overlay')
      if (window) {
        window.webContents.send('overlay-toggled', isOverlayVisible)
      }
    },
    onCaptureScreenshot: () => {
      const window = windowManager.getWindow('overlay')
      if (window) {
        window.webContents.send('capture-screenshot-requested')
      }
    },
    onTranslateText: () => {
      const window = windowManager.getWindow('overlay')
      if (window) {
        window.webContents.send('translate-text-requested')
      }
    },
    onToggleRecording: () => {
      const window = windowManager.getWindow('overlay')
      if (window) {
        window.webContents.send('toggle-recording-requested')
      }
    },
  })
}

const setupIPC = () => {
  const db = databaseService

  // ==================== SCREENSHOT ====================
  ipcMain.handle('capture-screenshot', async () => {
    try {
      const buffer = await ScreenshotService.captureScreen({
        quality: 85,
        maxWidth: 1280,
        maxHeight: 720,
        format: 'jpeg',
      })

      const compressed = await ScreenshotService.compressImage(buffer, 500)
      const base64 = ScreenshotService.bufferToBase64(compressed)

      return base64
    } catch (error) {
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  ipcMain.handle('capture-region', async (_, x: number, y: number, width: number, height: number) => {
    try {
      const buffer = await ScreenshotService.captureRegion(x, y, width, height, {
        quality: 85,
        format: 'jpeg',
      })

      const compressed = await ScreenshotService.compressImage(buffer, 300)
      const base64 = ScreenshotService.bufferToBase64(compressed)

      return base64
    } catch (error) {
      throw new Error(`Region screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  // ==================== EXPORT ====================
  ipcMain.handle(
    'export-conversation',
    async (_, messages: AIMessage[], title: string, options: ExportOptions) => {
      try {
        const filepath = await ExportService.exportConversation(messages, title, options)
        return filepath
      } catch (error) {
        throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  )

  ipcMain.handle('open-export-folder', async () => {
    try {
      await ExportService.openExportFolder()
      return true
    } catch (error) {
      throw new Error(`Failed to open folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  // ==================== DATABASE - CONVERSATIONS ====================
  ipcMain.handle('db-get-conversations', () => {
    return db.getAllConversations()
  })

  ipcMain.handle('db-get-conversation', (_, id: string) => {
    return db.getConversation(id)
  })

  ipcMain.handle('db-create-conversation', (_, title: string) => {
    return db.createConversation(title)
  })

  ipcMain.handle('db-update-conversation', (_, id: string, updates: { title?: string }) => {
    db.updateConversation(id, updates)
    return true
  })

  ipcMain.handle('db-delete-conversation', (_, id: string) => {
    db.deleteConversation(id)
    return true
  })

  // ==================== DATABASE - MESSAGES ====================
  ipcMain.handle('db-get-messages', (_, conversationId: string) => {
    return db.getMessages(conversationId)
  })

  ipcMain.handle('db-add-message', (_, conversationId: string, role: Message['role'], content: string, metadata?: MessageMetadata) => {
    return db.addMessage(conversationId, role, content, metadata)
  })

  ipcMain.handle('db-delete-message', (_, id: string) => {
    db.deleteMessage(id)
    return true
  })

  ipcMain.handle('db-update-message-metadata', (_, messageId: string, metadata: MessageMetadata) => {
    return db.updateMessageMetadata(messageId, metadata)
  })

  // ==================== DATABASE - SETTINGS ====================
  ipcMain.handle('db-get-setting', (_, key: string) => {
    return db.getSetting(key)
  })

  ipcMain.handle('db-get-all-settings', () => {
    return db.getAllSettings()
  })

  ipcMain.handle('db-set-setting', (_, key: string, value: string) => {
    db.setSetting(key, value)
    return true
  })

  // ==================== DISPLAY/MONITOR OPERATIONS ====================
  ipcMain.handle('get-all-displays', () => {
    return windowManager.getAllDisplays()
  })

  ipcMain.handle('get-display-bounds', () => {
    return windowManager.getDisplayBounds()
  })

  ipcMain.on('move-window-to-display', (_, overlayX: number, overlayY: number) => {
    windowManager.moveWindowToDisplay('overlay', overlayX, overlayY)
  })

  // ==================== OVERLAY CONTROL ====================
  ipcMain.on('screenshot-captured', () => {
    // Handle screenshot data
  })

  ipcMain.on('ai-response', () => {
    // Handle AI response
  })

  ipcMain.on('toggle-mouse-events', (_, ignore: boolean) => {
    windowManager.setIgnoreMouseEvents('overlay', ignore)
  })

  ipcMain.handle('get-overlay-state', () => {
    return {
      isVisible: isOverlayVisible,
      hotkeys: hotkeyManager.getRegisteredHotkeys(),
    }
  })

  // ==================== CONTENT PROTECTION (VISIBILIDADE EM CAPTURAS) ====================
  // Controla se a janela aparece em screenshots e compartilhamento de tela
  ipcMain.on('set-content-protection', (_, enabled: boolean) => {
    windowManager.setContentProtection('overlay', enabled)
  })
}

app.on('ready', initializeApp)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (windowManager.getWindowCount() === 0) {
    initializeApp()
  }
})

app.on('will-quit', () => {
  hotkeyManager.unregisterAll()
  windowManager.closeAll()
  databaseService.close()
})
