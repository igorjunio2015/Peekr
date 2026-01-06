import { BrowserWindow, screen, Display, nativeImage } from 'electron'
import * as path from 'path'

export interface WindowConfig {
  transparent?: boolean
  alwaysOnTop?: boolean
  ignoreMouseEvents?: boolean
  skipTaskbar?: boolean
  focusable?: boolean
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

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map()

  createOverlayWindow(config: WindowConfig = {}): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    const defaultConfig: WindowConfig = {
      transparent: true,
      alwaysOnTop: true,
      ignoreMouseEvents: false,
      skipTaskbar: false,
      focusable: true,
      ...config,
    }

    // Carregar ícone da aplicação
    const iconPath = path.join(__dirname, '../../public/peekr_logo.png')
    const icon = nativeImage.createFromPath(iconPath)

    // Criar janela normal no monitor primário
    const window = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      icon,
      title: 'Peekr',
      transparent: defaultConfig.transparent,
      alwaysOnTop: defaultConfig.alwaysOnTop,
      frame: false,
      skipTaskbar: defaultConfig.skipTaskbar,
      focusable: defaultConfig.focusable,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    })

    // Inicialmente ignora eventos do mouse para permitir click-through
    // O renderer vai alternar isso quando o mouse entrar no overlay
    window.setIgnoreMouseEvents(true, { forward: true })

    // IMPORTANTE: Tornar a janela invisível em capturas de tela e compartilhamento
    // Isso impede que o overlay apareça em screenshots ou screen sharing
    window.setContentProtection(true)

    this.windows.set('overlay', window)
    return window
  }

  getAllDisplays(): DisplayInfo[] {
    const displays = screen.getAllDisplays()
    return displays.map(display => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      touchSupport: display.touchSupport,
      monochrome: display.monochrome,
      accelerometerSupport: display.accelerometerSupport,
      colorSpace: display.colorSpace,
      colorDepth: display.colorDepth,
      depthPerComponent: display.depthPerComponent,
      displayFrequency: display.displayFrequency,
      size: display.size,
      workAreaSize: display.workAreaSize,
      internal: display.internal
    }))
  }

  getDisplayBounds(): DisplayBounds {
    const displays = screen.getAllDisplays()

    if (displays.length === 0) {
      const primary = screen.getPrimaryDisplay()
      return {
        totalBounds: primary.bounds,
        displays: [this.convertDisplayToInfo(primary)]
      }
    }

    // Calcular os limites totais de todos os monitores
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    displays.forEach(display => {
      minX = Math.min(minX, display.bounds.x)
      minY = Math.min(minY, display.bounds.y)
      maxX = Math.max(maxX, display.bounds.x + display.bounds.width)
      maxY = Math.max(maxY, display.bounds.y + display.bounds.height)
    })

    return {
      totalBounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      displays: displays.map(this.convertDisplayToInfo)
    }
  }

  private convertDisplayToInfo(display: Display): DisplayInfo {
    return {
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      touchSupport: display.touchSupport,
      monochrome: display.monochrome,
      accelerometerSupport: display.accelerometerSupport,
      colorSpace: display.colorSpace,
      colorDepth: display.colorDepth,
      depthPerComponent: display.depthPerComponent,
      displayFrequency: display.displayFrequency,
      size: display.size,
      workAreaSize: display.workAreaSize,
      internal: display.internal
    }
  }

  // Validar se uma posição está dentro dos limites dos monitores
  validatePosition(x: number, y: number, width: number = 0, height: number = 0): { x: number, y: number } {
    const displayBounds = this.getDisplayBounds()
    const displays = displayBounds.displays

    // Verificar se a posição está em algum monitor
    for (const display of displays) {
      const bounds = display.workArea
      if (x >= bounds.x && x < bounds.x + bounds.width &&
        y >= bounds.y && y < bounds.y + bounds.height) {
        // Posição válida, mas garantir que não saia dos limites
        return {
          x: Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - width)),
          y: Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - height))
        }
      }
    }

    // Se não está em nenhum monitor, mover para o monitor primário
    const primary = screen.getPrimaryDisplay()
    const bounds = primary.workArea
    return {
      x: Math.max(bounds.x, Math.min(bounds.x + 20, bounds.x + bounds.width - width)),
      y: Math.max(bounds.y, Math.min(bounds.y + 20, bounds.y + bounds.height - height))
    }
  }

  loadURL(window: BrowserWindow, isDevelopment: boolean): void {
    const url = isDevelopment
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../renderer/index.html')}`

    window.loadURL(url)

    if (isDevelopment) {
      window.webContents.openDevTools({ mode: 'detach' })
    }
  }

  toggleVisibility(windowId: string = 'overlay'): boolean {
    const window = this.windows.get(windowId)
    if (!window) return false

    if (window.isVisible()) {
      window.hide()
      return false
    } else {
      window.show()
      return true
    }
  }

  getWindow(windowId: string = 'overlay'): BrowserWindow | undefined {
    return this.windows.get(windowId)
  }

  closeWindow(windowId: string = 'overlay'): void {
    const window = this.windows.get(windowId)
    if (window && !window.isDestroyed()) {
      window.close()
    }
    this.windows.delete(windowId)
  }

  closeAll(): void {
    for (const [, window] of this.windows) {
      if (window && !window.isDestroyed()) {
        window.close()
      }
    }
    this.windows.clear()
  }

  setIgnoreMouseEvents(windowId: string, ignore: boolean): void {
    const window = this.windows.get(windowId)
    if (window) {
      // Quando ignore=true, passa eventos do mouse através da janela
      // forward: true permite que eventos ainda sejam detectados para hover
      window.setIgnoreMouseEvents(ignore, { forward: true })
    }
  }

  bringToFront(windowId: string = 'overlay'): void {
    const window = this.windows.get(windowId)
    if (window) {
      window.focus()
      window.moveTop()
    }
  }

  getWindowCount(): number {
    return this.windows.size
  }

  // Mover janela para um monitor específico baseado na posição do overlay
  moveWindowToDisplay(windowId: string, overlayX: number, overlayY: number): void {
    const window = this.windows.get(windowId)
    if (!window) return

    const displays = screen.getAllDisplays()
    let targetDisplay = null

    // Encontrar o monitor que contém a posição do overlay
    for (const display of displays) {
      const bounds = display.bounds
      if (overlayX >= bounds.x && overlayX < bounds.x + bounds.width &&
        overlayY >= bounds.y && overlayY < bounds.y + bounds.height) {
        targetDisplay = display
        break
      }
    }

    // Se encontrou um monitor diferente, mover a janela
    if (targetDisplay) {
      const currentBounds = window.getBounds()
      const targetBounds = targetDisplay.bounds

      // Só mover se não estiver já no monitor correto
      if (currentBounds.x !== targetBounds.x || currentBounds.y !== targetBounds.y ||
        currentBounds.width !== targetBounds.width || currentBounds.height !== targetBounds.height) {
        window.setBounds({
          x: targetBounds.x,
          y: targetBounds.y,
          width: targetBounds.width,
          height: targetBounds.height
        })
      }
    }
  }

  // Garantir que a janela mantenha always on top
  ensureAlwaysOnTop(windowId: string = 'overlay'): void {
    const window = this.windows.get(windowId)
    if (window && !window.isDestroyed()) {
      window.setAlwaysOnTop(true)
      window.focus()
    }
  }

  // Controlar proteção de conteúdo (visibilidade em capturas de tela e compartilhamento)
  // Quando enabled=true, a janela fica INVISÍVEL em screenshots e screen sharing
  // Quando enabled=false, a janela fica VISÍVEL em screenshots e screen sharing
  setContentProtection(windowId: string = 'overlay', enabled: boolean): void {
    const window = this.windows.get(windowId)
    if (window && !window.isDestroyed()) {
      window.setContentProtection(enabled)
    }
  }

  // Obter estado atual da proteção de conteúdo
  getContentProtectionState(windowId: string = 'overlay'): boolean {
    const window = this.windows.get(windowId)
    if (window && !window.isDestroyed()) {
      // Não há método nativo para verificar, então retornamos o estado padrão
      // O estado real será gerenciado pelo renderer através das configurações
      return true // Padrão é protegido
    }
    return true
  }
}
