import {
  AlertCircle,
  Bot,
  Camera,
  CheckCircle,
  Clock,
  Computer,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Image,
  Infinity as InfinityIcon,
  Loader2,
  Menu,
  Mic,
  Minus,
  Monitor,
  Package,
  Pause,
  Play,
  Plus,
  Send,
  Settings as SettingsIcon,
  Shrink,
  Square,
  Volume2,
  X,
  Zap
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Streamdown } from 'streamdown'
import { useAIStreaming } from '../hooks/useAIStreaming'
import { useCombinedAudio } from '../hooks/useCombinedAudio'
import { useDatabase, MessageMetadata } from '../hooks/useDatabase'
import { useElectronAPI } from '../hooks/useElectronAPI'
import { useExport } from '../hooks/useExport'
import { Settings } from './Settings'
import { AudioWaveformWaveSurfer } from './AudioWaveformWaveSurfer'

// Temas de cores predefinidos (mesmo do Settings)
const colorThemes = {
  cyan: {
    name: 'Ciano (Padrão)',
    primary: '#06b6d4',
    secondary: '#0891b2',
    accent: '#22d3ee',
    border: 'rgba(6, 182, 212, 0.3)',
    gradient: 'from-cyan-500/60 to-blue-600/60',
    hoverGradient: 'from-cyan-500/80 to-blue-600/80',
    borderColor: 'border-cyan-400/50',
    shadow: 'shadow-cyan-500/20',
  },
  purple: {
    name: 'Roxo',
    primary: '#8b5cf6',
    secondary: '#7c3aed',
    accent: '#a78bfa',
    border: 'rgba(139, 92, 246, 0.3)',
    gradient: 'from-purple-500/60 to-violet-600/60',
    hoverGradient: 'from-purple-500/80 to-violet-600/80',
    borderColor: 'border-purple-400/50',
    shadow: 'shadow-purple-500/20',
  },
  green: {
    name: 'Verde',
    primary: '#10b981',
    secondary: '#059669',
    accent: '#34d399',
    border: 'rgba(16, 185, 129, 0.3)',
    gradient: 'from-emerald-500/60 to-green-600/60',
    hoverGradient: 'from-emerald-500/80 to-green-600/80',
    borderColor: 'border-emerald-400/50',
    shadow: 'shadow-emerald-500/20',
  },
  orange: {
    name: 'Laranja',
    primary: '#f97316',
    secondary: '#ea580c',
    accent: '#fb923c',
    border: 'rgba(249, 115, 22, 0.3)',
    gradient: 'from-orange-500/60 to-amber-600/60',
    hoverGradient: 'from-orange-500/80 to-amber-600/80',
    borderColor: 'border-orange-400/50',
    shadow: 'shadow-orange-500/20',
  },
  pink: {
    name: 'Rosa',
    primary: '#ec4899',
    secondary: '#db2777',
    accent: '#f472b6',
    border: 'rgba(236, 72, 153, 0.3)',
    gradient: 'from-pink-500/60 to-rose-600/60',
    hoverGradient: 'from-pink-500/80 to-rose-600/80',
    borderColor: 'border-pink-400/50',
    shadow: 'shadow-pink-500/20',
  },
  blue: {
    name: 'Azul',
    primary: '#3b82f6',
    secondary: '#2563eb',
    accent: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.3)',
    gradient: 'from-blue-500/60 to-indigo-600/60',
    hoverGradient: 'from-blue-500/80 to-indigo-600/80',
    borderColor: 'border-blue-400/50',
    shadow: 'shadow-blue-500/20',
  },
}

// Função para limpar mensagens antes de enviar para a API
// Remove marcadores de mídia (áudio, imagem) e mantém apenas o texto
const cleanMessageForAPI = (content: string): string => {
  // Remover marcadores de áudio [AUDIO:url]
  let cleaned = content.replace(/\[AUDIO:[^\]]+\]\n?/g, '')
  // Remover marcadores de imagem [IMG:base64data]
  cleaned = cleaned.replace(/\[IMG:[^\]]+\]\n?/g, '')
  // Remover labels como [Áudio do Sistema] ou [Screenshot capturado]
  cleaned = cleaned.replace(/\[(Áudio do Sistema|Screenshot capturado)\]\n?/g, '')
  // Limpar espaços extras
  cleaned = cleaned.trim()
  return cleaned
}

interface OverlayProps {
  apiKey: string
}

interface Position {
  x: number
  y: number
}

export const Overlay: React.FC<OverlayProps> = ({ apiKey }) => {
  const [userInput, setUserInput] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 })
  const [minimizedPosition, setMinimizedPosition] = useState<Position | null>(null) // Posição original da bolinha
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('')
  const [currentResponse, setCurrentResponse] = useState('')
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null)
  
  // Estados para redimensionamento
  const [size, setSize] = useState(() => {
    // Tentar carregar tamanho salvo do localStorage
    const saved = localStorage.getItem('overlay-size')
    return saved ? JSON.parse(saved) : { width: 420, height: 700 }
  })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string>('')
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  
  // Estado para informações dos displays
  const [displayBounds, setDisplayBounds] = useState<any>(null)
  const [availableDisplays, setAvailableDisplays] = useState<any[]>([])
  const [currentDisplayId, setCurrentDisplayId] = useState<number>(0)
  const [showDisplaySelector, setShowDisplaySelector] = useState(false)

  // Salvar tamanho e posição no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem('overlay-size', JSON.stringify(size))
  }, [size])

  useEffect(() => {
    localStorage.setItem('overlay-position', JSON.stringify(position))
  }, [position])

  // Hooks
  const { streamAIResponse, isLoading, error, analyzeImage, transcribeAudio, tokenStats, costStats, condenseContextManually, isCondensing, updateContextEstimate } = useAIStreaming(apiKey)
  const { captureScreenshot, toggleMouseEvents, onScreenshotRequested, onOverlayToggled, onRecordingRequested, getDisplayBounds, getAllDisplays, moveWindowToDisplay, setContentProtection } = useElectronAPI()
  const { exportAsMarkdown, downloadAsFile } = useExport()
  
  // Estado para visibilidade em capturas (toggle rápido no header)
  const [isVisibleInCaptures, setIsVisibleInCaptures] = useState(() => {
    // Carregar do localStorage, por padrão é false (oculto em capturas)
    const saved = localStorage.getItem('overlay-visible-in-captures')
    return saved === 'true'
  })
  
  // Aplicar content protection quando o estado mudar
  useEffect(() => {
    // true = oculto em capturas, false = visível em capturas
    setContentProtection(!isVisibleInCaptures)
    localStorage.setItem('overlay-visible-in-captures', String(isVisibleInCaptures))
  }, [isVisibleInCaptures, setContentProtection])

  // Função para validar se uma posição está dentro dos limites dos monitores
  const validatePosition = useCallback((x: number, y: number, width: number = size.width, height: number = size.height) => {
    if (!displayBounds || !displayBounds.displays) {
      return { x, y } // Sem validação se não temos info dos displays
    }

    // Encontrar o monitor mais próximo da posição atual
    let closestDisplay = displayBounds.displays[0]
    let minDistance = Infinity

    for (const display of displayBounds.displays) {
      const bounds = display.workArea
      const centerX = bounds.x + bounds.width / 2
      const centerY = bounds.y + bounds.height / 2
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
      
      if (distance < minDistance) {
        minDistance = distance
        closestDisplay = display
      }
    }

    // Verificar se pelo menos parte do overlay está visível em algum monitor
    const overlayRight = x + width
    const overlayBottom = y + height

    for (const display of displayBounds.displays) {
      const bounds = display.workArea
      
      // Verificar se há sobreposição entre o overlay e o monitor
      if (overlayRight > bounds.x && x < bounds.x + bounds.width &&
          overlayBottom > bounds.y && y < bounds.y + bounds.height) {
        // Há sobreposição, permitir a posição
        return { x, y }
      }
    }

    // Se não há sobreposição com nenhum monitor, mover para o monitor mais próximo
    const bounds = closestDisplay.workArea
    return {
      x: Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - width)),
      y: Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - height))
    }
  }, [displayBounds, size])

  // Carregar posição salva na inicialização e informações dos displays
  useEffect(() => {
    const loadDisplayInfo = async () => {
      const bounds = await getDisplayBounds()
      const displays = await getAllDisplays()
      
      console.log('Display bounds loaded:', bounds)
      console.log('Available displays:', displays)
      
      setDisplayBounds(bounds)
      setAvailableDisplays(displays)
      
      // Definir monitor atual (primário por padrão)
      const primaryDisplay = displays.find((d: any) => d.bounds.x === 0 && d.bounds.y === 0) || displays[0]
      if (primaryDisplay) {
        setCurrentDisplayId(primaryDisplay.id)
      }
      
      // Validar posição salva após carregar informações dos displays
      const savedPosition = localStorage.getItem('overlay-position')
      if (savedPosition) {
        const pos = JSON.parse(savedPosition)
        console.log('Saved position:', pos)
        setPosition(pos)
      }
    }
    
    loadDisplayInfo()
  }, [getDisplayBounds, getAllDisplays])

  // Função para mudar para um monitor específico
  const switchToDisplay = useCallback((displayId: number) => {
    const targetDisplay = availableDisplays.find((d: any) => d.id === displayId)
    if (!targetDisplay) return

    setCurrentDisplayId(displayId)
    setShowDisplaySelector(false)
    
    // Mover janela para o monitor selecionado
    moveWindowToDisplay(targetDisplay.bounds.x + 100, targetDisplay.bounds.y + 100)
    
    // Posicionar overlay no centro do novo monitor
    setPosition({
      x: 20,
      y: 20
    })
  }, [availableDisplays, moveWindowToDisplay])
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    messages,
    settings,
    createConversation,
    deleteConversation,
    addMessage,
    setSetting,
    getCurrentConversation,
  } = useDatabase()

  // CRÍTICO: Usar useRef para evitar re-renderizações que interrompem a gravação
  const audioProcessingRef = useRef({
    transcribeAudio,
    currentConversationId,
    createConversation,
    addMessage,
    messages,
    settings,
    streamAIResponse,
    setTranscriptionStatus,
    setCurrentResponse
  })

  // Atualizar ref sempre que as dependências mudarem (sem afetar o callback)
  useEffect(() => {
    audioProcessingRef.current = {
      transcribeAudio,
      currentConversationId,
      createConversation,
      addMessage,
      messages,
      settings,
      streamAIResponse,
      setTranscriptionStatus,
      setCurrentResponse
    }
  }, [transcribeAudio, currentConversationId, createConversation, addMessage, messages, settings, streamAIResponse])

  // Hook para captura de áudio do sistema (não microfone)
  // CRÍTICO: Este callback JAMAIS deve parar a gravação, mesmo com erros ou re-renderizações
  const handleAudioChunk = useCallback(async (blob: Blob) => {
    console.log('[Audio] 🎯 CHUNK RECEBIDO - Processando em background!')
    
    // IMPORTANTE: Processar de forma completamente isolada da gravação
    // Usar setTimeout para garantir que nunca bloqueia e não é afetado por re-renders
    setTimeout(async () => {
      try {
        // Usar ref para acessar valores atuais sem dependências
        const {
          transcribeAudio: currentTranscribeAudio,
          currentConversationId: currentConvId,
          createConversation: currentCreateConversation,
          addMessage: currentAddMessage,
          messages: currentMessages,
          settings: currentSettings,
          streamAIResponse: currentStreamAIResponse,
          setTranscriptionStatus: currentSetTranscriptionStatus,
          setCurrentResponse: currentSetCurrentResponse
        } = audioProcessingRef.current
        
        // Obter idioma das configurações
        const transcriptionLanguage = currentSettings?.language || 'pt'
        
        // Transcrever e processar automaticamente - SEM afetar status de gravação
        currentSetTranscriptionStatus('Transcrevendo áudio capturado...')
        
        console.log('[Audio] Transcrevendo chunk de', blob.size, 'bytes, idioma:', transcriptionLanguage)
        
        // Chamar transcrição - sempre retorna um objeto, nunca lança erro
        const transcriptionResult = await currentTranscribeAudio(blob, transcriptionLanguage)
        
        // Verificar se temos texto transcrito (independente de erro)
        if (transcriptionResult && transcriptionResult.text && transcriptionResult.text.trim()) {
          console.log('[Audio] ✅ Transcrição bem-sucedida:', transcriptionResult.text.substring(0, 50) + '...')
          
          try {
            // Adicionar transcrição como mensagem do usuário com preview de áudio
            // Formato: [AUDIO:audioUrl] para identificar que é um áudio + texto
            // IMPORTANTE: Capturar o conversation_id retornado para usar na próxima mensagem
            // NOTA: Salvamos a URL do áudio para exibição, mas enviamos APENAS o texto para a API
            const audioMessage = `[AUDIO:${transcriptionResult.audioUrl}]\n[Áudio do Sistema]\n${transcriptionResult.text}`
            const userMsg = await currentAddMessage('user', audioMessage)
            
            // Obter o conversation_id da mensagem criada para garantir que a resposta vá para a mesma conversa
            const conversationId = userMsg?.conversation_id
            
            // Enviar para IA processar baseado no system prompt
            // IMPORTANTE: Filtrar marcadores de mídia das mensagens para não exceder contexto
            const systemPrompt = currentSettings?.system_prompt || 'Você é um assistente útil.'
            const apiMessages = currentMessages.map(m => ({
              role: m.role,
              content: cleanMessageForAPI(m.content)
            }))
            apiMessages.push({ role: 'user' as const, content: transcriptionResult.text })
            
            let fullResponse = ''
            currentSetCurrentResponse('')
            
            await currentStreamAIResponse(
              apiMessages,
              (chunk) => {
                fullResponse += chunk
                currentSetCurrentResponse(fullResponse)
              },
              async () => {
                if (fullResponse) {
                  // Passar o conversation_id explicitamente para garantir que vai para a mesma conversa
                  await currentAddMessage('assistant', fullResponse, conversationId)
                  currentSetCurrentResponse('')
                  // Auto-expandir quando IA responder (se estiver minimizado)
                  setIsMinimized(false)
                }
              },
              {
                model: (currentSettings?.model as any) || 'gpt-4o',
                systemPrompt,
              }
            )
            
            // Se chegou até aqui, tudo funcionou perfeitamente
            currentSetTranscriptionStatus('Áudio processado com sucesso!')
            
          } catch (processError) {
            console.error('[Audio] Erro ao processar áudio transcrito (gravação continua):', processError)
            // Mesmo com erro no processamento, a transcrição funcionou
            currentSetTranscriptionStatus('Áudio transcrito, mas erro no processamento')
          }
          
        } else {
          // Não temos texto transcrito
          console.log('[Audio] ❌ Nenhuma fala detectada ou erro na transcrição (gravação continua)')
          
          // Verificar se é um erro baseado no texto vazio
          console.log('[Audio] Nenhuma fala detectada (gravação continua)')
          currentSetTranscriptionStatus('Nenhuma fala detectada no áudio')
        }
        
      } catch (fatalError) {
        // Capturar qualquer erro fatal e garantir que não afeta a gravação
        console.error('[Audio] ERRO FATAL no processamento (gravação continua):', fatalError)
        audioProcessingRef.current.setTranscriptionStatus('Erro no processamento do áudio')
      } finally {
        // Sempre limpar status após alguns segundos
        setTimeout(() => {
          audioProcessingRef.current.setTranscriptionStatus('')
        }, 3000)
      }
    }, 0) // Processar imediatamente mas de forma assíncrona
    
    console.log('[Audio] ✅ CHUNK ENVIADO PARA BACKGROUND - Gravação continua!')
    
  }, []) // SEM DEPENDÊNCIAS - callback nunca muda, evita re-renderizações

  // Configurações de áudio das settings
  const maxChunkDurationValue = settings?.max_chunk_duration ? parseInt(settings.max_chunk_duration) : 30000
  const infiniteLoopValue = settings?.infinite_loop_recording === 'false' ? false : true // Default true
  const enableMicrophoneValue = settings?.enable_microphone === 'true'
  const microphoneDeviceValue = settings?.microphone_device || 'default'

  // Configurações de aparência
  const appearanceSettings = useMemo(() => {
    const opacity = settings?.overlay_opacity ? parseInt(settings.overlay_opacity) : 85
    const theme = (settings?.color_theme || 'cyan') as keyof typeof colorThemes
    const radius = settings?.border_radius ? parseInt(settings.border_radius) : 16
    const blur = settings?.blur_intensity ? parseInt(settings.blur_intensity) : 12
    
    const currentTheme = colorThemes[theme] || colorThemes.cyan
    
    // Converter hex para rgba
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    
    return {
      opacity,
      theme,
      radius,
      blur,
      currentTheme,
      // Estilos calculados - usando slate (mais escuro/preto) em vez de gray (azulado)
      // slate-950: #020617, slate-900: #0f172a, slate-800: #1e293b, slate-700: #334155
      overlayBackground: `rgba(2, 6, 23, ${opacity / 100})`, // slate-950
      borderColor: currentTheme.border,
      accentColor: currentTheme.accent,
      primaryColor: currentTheme.primary,
      secondaryColor: currentTheme.secondary,
      // Cores com transparência para elementos
      primaryBg: hexToRgba(currentTheme.primary, 0.2),
      primaryBgHover: hexToRgba(currentTheme.primary, 0.3),
      primaryBgStrong: hexToRgba(currentTheme.primary, 0.5),
      secondaryBg: hexToRgba(currentTheme.secondary, 0.3),
      accentText: currentTheme.accent,
      // Gradientes dinâmicos - usando slate
      buttonGradient: `linear-gradient(to right, ${hexToRgba(currentTheme.primary, 0.6)}, ${hexToRgba(currentTheme.secondary, 0.6)})`,
      buttonGradientHover: `linear-gradient(to right, ${hexToRgba(currentTheme.primary, 0.8)}, ${hexToRgba(currentTheme.secondary, 0.8)})`,
      headerGradient: `linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.9))`, // slate-900 to slate-950
      // Bordas
      borderLight: hexToRgba(currentTheme.primary, 0.2),
      borderMedium: hexToRgba(currentTheme.primary, 0.3),
      borderStrong: hexToRgba(currentTheme.primary, 0.5),
      // Cores de fundo slate para elementos
      slateBg: 'rgba(15, 23, 42, 0.6)', // slate-900
      slateBgLight: 'rgba(30, 41, 59, 0.5)', // slate-800
      slateBgDark: 'rgba(2, 6, 23, 0.8)', // slate-950
    }
  }, [settings?.overlay_opacity, settings?.color_theme, settings?.border_radius, settings?.blur_intensity])

  const {
    isCapturing: isRecording,
    isPaused,
    duration,
    currentChunkDuration,
    chunksProcessed,
    systemAudioActive,
    microphoneActive,
    startCapture: startRecording,
    stopCapture: stopRecording,
    pauseCapture: pauseRecording,
    resumeCapture: resumeRecording,
    formatDuration,
    error: audioError,
  } = useCombinedAudio({
    maxChunkDuration: maxChunkDurationValue,
    onChunkReady: handleAudioChunk,
    infiniteLoop: infiniteLoopValue,
    enableMicrophone: enableMicrophoneValue,
    microphoneDeviceId: microphoneDeviceValue,
  })

  const responseRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const screenshotHandlerRef = useRef<boolean>(false)
  const recordingHandlerRef = useRef<boolean>(false)

  // Handler de screenshot - usando ref para evitar múltiplas chamadas
  const handleScreenshotRequest = useCallback(async () => {
    if (screenshotHandlerRef.current) return // Evitar chamadas duplicadas
    screenshotHandlerRef.current = true
    
    setStatusMessage('📸 Capturando screenshot...')
    try {
      const screenshot = await captureScreenshot()
      if (screenshot) {
        await handleScreenshotCapture(screenshot)
      } else {
        setStatusMessage('❌ Falha ao capturar screenshot')
        setTimeout(() => setStatusMessage(''), 3000)
      }
    } catch (err) {
      setStatusMessage(`❌ Erro: ${err}`)
      setTimeout(() => setStatusMessage(''), 3000)
    } finally {
      screenshotHandlerRef.current = false
    }
  }, [captureScreenshot])

  // Handler de gravação
  const handleRecordingRequest = useCallback(() => {
    if (recordingHandlerRef.current) return
    recordingHandlerRef.current = true
    
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
    
    setTimeout(() => {
      recordingHandlerRef.current = false
    }, 500)
  }, [isRecording, startRecording, stopRecording])

  // Registrar callbacks do Electron - apenas uma vez
  useEffect(() => {
    let mounted = true
    
    onScreenshotRequested(() => {
      if (mounted) handleScreenshotRequest()
    })

    onOverlayToggled((isVisible) => {
      if (mounted && !isVisible) {
        // Restaurar a posição original da bolinha se existir
        if (minimizedPosition) {
          setPosition(minimizedPosition)
        }
        setIsMinimized(true)
      }
    })

    onRecordingRequested(() => {
      if (mounted) handleRecordingRequest()
    })

    return () => {
      mounted = false
    }
  }, [handleScreenshotRequest, handleRecordingRequest, onScreenshotRequested, onOverlayToggled, onRecordingRequested])

  const handleScreenshotCapture = async (screenshotData: string) => {
    // Salvar screenshot para preview
    setLastScreenshot(screenshotData)
    
    // Adicionar mensagem do usuário com marcador especial para imagem
    // Formato: [IMG:base64data] para identificar que é uma imagem
    // IMPORTANTE: Capturar o conversation_id retornado para usar na próxima mensagem
    const userMsg = await addMessage('user', `[IMG:${screenshotData}]\n[Screenshot capturado] Analise esta imagem e forneça insights.`)
    
    // Obter o conversation_id da mensagem criada para garantir que a resposta vá para a mesma conversa
    const conversationId = userMsg?.conversation_id
    
    setStatusMessage('Analisando imagem com GPT-4o...')
    setCurrentResponse('')

    try {
      const systemPrompt = settings?.system_prompt || 'Você é um assistente útil.'
      const analysis = await analyzeImage(
        screenshotData,
        `${systemPrompt}\n\nAnalise esta screenshot detalhadamente. Descreva o que você vê, identifique elementos importantes, e forneça insights úteis. Responda em português.`
      )

      if (analysis) {
        // Passar o conversation_id explicitamente para garantir que vai para a mesma conversa
        await addMessage('assistant', analysis, conversationId)
        setStatusMessage('Análise concluída!')
      } else {
        setStatusMessage('Sem resposta da análise')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
      setStatusMessage(`Erro: ${errorMsg}`)
      // Passar o conversation_id explicitamente para garantir que vai para a mesma conversa
      await addMessage('assistant', `Erro ao analisar imagem: ${errorMsg}`, conversationId)
    }
    
    setTimeout(() => setStatusMessage(''), 3000)
  }

  // Função para renderizar conteúdo da mensagem (com suporte a imagens e áudio)
  const renderMessageContent = (content: string) => {
    // Opacidade mínima para bubbles de mídia (pelo menos 60% mesmo quando opacidade geral é baixa)
    const bubbleOpacity = Math.max(0.6, appearanceSettings.opacity / 100)
    
    // Verificar se a mensagem contém uma imagem
    const imgMatch = content.match(/\[IMG:([^\]]+)\]/)
    if (imgMatch) {
      const imageData = imgMatch[1]
      const textContent = content.replace(/\[IMG:[^\]]+\]\n?/, '')
      
      return (
        <div>
          <div style={{
            background: `rgba(8, 145, 178, ${bubbleOpacity * 0.3})`,
            border: `1px solid rgba(6, 182, 212, ${bubbleOpacity * 0.5})`,
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              color: '#67e8f9',
              marginBottom: '8px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Camera size={14} /> Screenshot Capturado
            </div>
            <img
              src={`data:image/jpeg;base64,${imageData}`}
              alt="Screenshot"
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                borderRadius: '8px',
                cursor: 'pointer',
                border: `1px solid rgba(6, 182, 212, ${bubbleOpacity * 0.4})`,
              }}
              onClick={() => setScreenshotPreview(imageData)}
            />
          </div>
          {textContent && (
            <div style={{
              background: `rgba(55, 65, 81, ${bubbleOpacity * 0.5})`,
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              color: '#d1d5db',
              border: `1px solid rgba(75, 85, 99, ${bubbleOpacity * 0.5})`,
            }}>
              {textContent}
            </div>
          )}
        </div>
      )
    }
    
    // Verificar se a mensagem contém um áudio
    const audioMatch = content.match(/\[AUDIO:([^\]]+)\]/)
    if (audioMatch) {
      const audioUrl = audioMatch[1]
      const textContent = content.replace(/\[AUDIO:[^\]]+\]\n?/, '').replace(/\[Áudio do Sistema\]\n?/, '').trim()
      
      return (
        <div>
          <div style={{
            marginBottom: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              color: appearanceSettings.accentText,
              marginBottom: '8px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Volume2 size={14} /> Áudio Capturado
            </div>
            <AudioWaveformWaveSurfer
              audioUrl={audioUrl}
              accentColor={appearanceSettings.primaryColor}
              backgroundColor="rgba(30, 41, 59, 0.8)"
              waveColor="rgba(148, 163, 184, 0.5)"
              progressColor={appearanceSettings.accentText}
              height={40}
              barWidth={2}
              barGap={1}
              barRadius={2}
            />
          </div>
          {textContent && (
            <div style={{
              background: `rgba(55, 65, 81, ${bubbleOpacity * 0.5})`,
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              color: '#d1d5db',
              border: `1px solid rgba(75, 85, 99, ${bubbleOpacity * 0.5})`,
            }}>
              <div style={{
                fontSize: '11px',
                color: '#9ca3af',
                marginBottom: '4px',
                fontWeight: 500,
              }}>
                Transcrição:
              </div>
              {textContent}
            </div>
          )}
        </div>
      )
    }
    
    return content
  }

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return

    // Adicionar mensagem do usuário e capturar o conversation_id
    const userMsg = await addMessage('user', userInput)
    const conversationId = userMsg?.conversation_id
    
    const inputText = userInput
    setUserInput('')
    setCurrentResponse('')

    // Preparar mensagens para a API - filtrar marcadores de mídia
    const apiMessages = messages.map(m => ({
      role: m.role,
      content: cleanMessageForAPI(m.content)
    }))
    apiMessages.push({ role: 'user' as const, content: inputText })

    let fullResponse = ''

    await streamAIResponse(
      apiMessages,
      (chunk) => {
        fullResponse += chunk
        setCurrentResponse(fullResponse)
      },
      async () => {
        if (fullResponse) {
          // Passar o conversation_id explicitamente para garantir que vai para a mesma conversa
          await addMessage('assistant', fullResponse, conversationId)
          setCurrentResponse('')
          // Auto-expandir quando IA responder (se estiver minimizado)
          setIsMinimized(false)
        }
      },
      {
        model: (settings?.model as any) || 'gpt-4o',
        systemPrompt: settings?.system_prompt,
      }
    )
  }

  // Mouse enter/leave para controlar click-through
  const handleMouseEnter = useCallback(() => {
    toggleMouseEvents(false)
  }, [toggleMouseEvents])

  const handleMouseLeave = useCallback(() => {
    if (!isDragging && !showSettings && !screenshotPreview && !isResizing) {
      toggleMouseEvents(true)
    }
  }, [toggleMouseEvents, isDragging, showSettings, screenshotPreview, isResizing])

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const rect = overlayRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }, [])

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      // Restringir movimento dentro do monitor atual
      const currentDisplay = availableDisplays.find((d: any) => d.id === currentDisplayId)
      if (currentDisplay) {
        const bounds = currentDisplay.workArea
        // Usar tamanho correto baseado no estado (minimizado = 56px, expandido = size.width/height)
        const effectiveWidth = isMinimized ? 56 : size.width
        const effectiveHeight = isMinimized ? 56 : size.height
        const constrainedX = Math.max(0, Math.min(newX, bounds.width - effectiveWidth))
        const constrainedY = Math.max(0, Math.min(newY, bounds.height - effectiveHeight))
        
        setPosition({ x: constrainedX, y: constrainedY })
      } else {
        // Fallback se não encontrar o monitor atual
        setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) })
      }
    }
  }, [isDragging, dragOffset, availableDisplays, currentDisplayId, size, isMinimized])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handlers de redimensionamento
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    })
  }, [size])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const deltaX = e.clientX - resizeStart.x
    const deltaY = e.clientY - resizeStart.y

    let newWidth = resizeStart.width
    let newHeight = resizeStart.height

    if (resizeDirection.includes('right')) {
      newWidth = Math.max(300, resizeStart.width + deltaX)
    }
    if (resizeDirection.includes('left')) {
      newWidth = Math.max(300, resizeStart.width - deltaX)
    }
    if (resizeDirection.includes('bottom')) {
      newHeight = Math.max(400, resizeStart.height + deltaY)
    }
    if (resizeDirection.includes('top')) {
      newHeight = Math.max(400, resizeStart.height - deltaY)
    }

    setSize({ width: newWidth, height: newHeight })

    // Ajustar posição se redimensionando pela esquerda ou topo
    if (resizeDirection.includes('left')) {
      setPosition(prev => ({ ...prev, x: prev.x + (resizeStart.width - newWidth) }))
    }
    if (resizeDirection.includes('top')) {
      setPosition(prev => ({ ...prev, y: prev.y + (resizeStart.height - newHeight) }))
    }
  }, [isResizing, resizeDirection, resizeStart])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    setResizeDirection('')
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  // Auto-scroll para novas mensagens
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight
    }
  }, [currentResponse, messages])

  // Atualizar estimativa de tokens quando mensagens mudarem ou conversa mudar
  useEffect(() => {
    // Sempre atualizar a estimativa, mesmo com 0 mensagens (para resetar quando mudar de conversa)
    // IMPORTANTE: Usar mensagens limpas (sem marcadores de mídia) para estimativa correta
    const apiMessages = messages.map(m => ({
      role: m.role,
      content: cleanMessageForAPI(m.content)
    }))
    updateContextEstimate(apiMessages, settings?.model || 'gpt-4o')
  }, [messages, currentConversationId, settings?.model, updateContextEstimate])

  // Fechar modal de screenshot com ESC e dropdown de monitor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (screenshotPreview) {
          setScreenshotPreview(null)
        }
        if (showDisplaySelector) {
          setShowDisplaySelector(false)
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      // Verificar se o clique foi fora do dropdown de monitor
      const target = e.target as Element
      if (showDisplaySelector && !target.closest('[data-monitor-dropdown]')) {
        setShowDisplaySelector(false)
      }
    }

    if (screenshotPreview || showDisplaySelector) {
      document.addEventListener('keydown', handleKeyDown)
      // Adicionar listener com delay para evitar fechamento imediato
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 100)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [screenshotPreview, showDisplaySelector])

  // Função para expandir o overlay com ajuste de posição inteligente
  const handleExpand = useCallback(() => {
    // Salvar a posição original da bolinha antes de expandir
    setMinimizedPosition({ x: position.x, y: position.y })
    
    // Obter informações do monitor atual
    const currentDisplay = availableDisplays.find((d: any) => d.id === currentDisplayId)
    if (currentDisplay) {
      const bounds = currentDisplay.workArea
      const expandedHeight = size.height
      const expandedWidth = size.width
      const minimizedSize = 56 // Tamanho da bolinha minimizada
      
      let newX = position.x
      let newY = position.y
      
      // Verificar se há espaço suficiente abaixo para o overlay expandido
      const spaceBelow = bounds.height - position.y - minimizedSize
      const spaceAbove = position.y
      
      // Se não há espaço suficiente abaixo, mas há acima, abrir para cima
      if (spaceBelow < expandedHeight && spaceAbove >= expandedHeight) {
        // Ajustar Y para que o overlay abra para cima
        // A posição Y deve ser tal que o fundo do overlay fique onde estava o fundo da bolinha
        newY = position.y + minimizedSize - expandedHeight
      } else if (spaceBelow < expandedHeight && spaceAbove < expandedHeight) {
        // Não há espaço suficiente nem acima nem abaixo, centralizar verticalmente
        newY = Math.max(0, (bounds.height - expandedHeight) / 2)
      }
      // Se há espaço abaixo, mantém a posição Y atual (abre para baixo)
      
      // Verificar também horizontalmente
      const spaceRight = bounds.width - position.x
      if (spaceRight < expandedWidth) {
        // Ajustar X para que o overlay não saia da tela pela direita
        newX = Math.max(0, bounds.width - expandedWidth)
      }
      
      // Garantir que não fique com valores negativos
      newX = Math.max(0, newX)
      newY = Math.max(0, newY)
      
      // Atualizar posição se necessário
      if (newX !== position.x || newY !== position.y) {
        setPosition({ x: newX, y: newY })
      }
    }
    
    setIsMinimized(false)
  }, [position, size, availableDisplays, currentDisplayId])

  // Função para minimizar o overlay e restaurar a posição original da bolinha
  const handleMinimize = useCallback(() => {
    // Restaurar a posição original da bolinha se existir
    if (minimizedPosition) {
      setPosition(minimizedPosition)
    }
    setIsMinimized(true)
  }, [minimizedPosition])

  // Bolinha minimizada
  if (isMinimized) {
    return (
      <div
        className="fixed pointer-events-auto"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Bolinha principal */}
        <div
          ref={overlayRef}
          className="w-14 h-14 rounded-full border-2 shadow-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110"
          style={{
            backdropFilter: `blur(${appearanceSettings.blur}px)`,
            background: isRecording
              ? 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.6), rgba(220, 38, 38, 0.6))'
              : appearanceSettings.buttonGradient,
            borderColor: isRecording
              ? 'rgba(248, 113, 113, 0.5)'
              : appearanceSettings.borderMedium,
            boxShadow: isRecording
              ? '0 4px 12px rgba(239, 68, 68, 0.2)'
              : `0 4px 12px ${appearanceSettings.primaryBg}`,
          }}
          onClick={handleExpand}
          onMouseDown={handleDragStart}
        >
          {isRecording ? (
            <div className="flex flex-col items-center">
              <Volume2 size={12} className="text-white animate-pulse" />
              <span className="text-white text-xs font-bold drop-shadow-lg">REC</span>
            </div>
          ) : (
            <span className="text-white text-sm font-bold drop-shadow-lg">AI</span>
          )}
        </div>

        {/* Botões flutuantes */}
        <div className="absolute -right-32 top-1/2 transform -translate-y-1/2 flex gap-0.5">
          {/* Botão Gravar */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className="w-10 h-10 rounded-full border shadow-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110"
            style={{
              backdropFilter: `blur(${appearanceSettings.blur}px)`,
              background: isRecording
                ? 'rgba(239, 68, 68, 0.6)'
                : 'rgba(55, 65, 81, 0.6)',
              borderColor: isRecording
                ? 'rgba(248, 113, 113, 0.5)'
                : 'rgba(107, 114, 128, 0.5)',
              boxShadow: isRecording
                ? '0 4px 12px rgba(239, 68, 68, 0.2)'
                : '0 4px 12px rgba(107, 114, 128, 0.2)',
            }}
            title={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
          >
            {isRecording ? <Square size={14} className="text-white" /> : <Volume2 size={14} className="text-white" />}
          </button>

          {/* Botão Screenshot */}
          <button
            onClick={handleScreenshotRequest}
            className="w-10 h-10 rounded-full border shadow-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110"
            style={{
              backdropFilter: `blur(${appearanceSettings.blur}px)`,
              background: appearanceSettings.primaryBg,
              borderColor: appearanceSettings.borderLight,
              boxShadow: `0 4px 12px ${appearanceSettings.primaryBg}`,
            }}
            title="Capturar screenshot"
          >
            <Camera size={14} style={{ color: appearanceSettings.accentText }} />
          </button>

          {/* Botão Settings */}
          <button
            onClick={() => {
              handleExpand()
              setShowSettings(true)
            }}
            className="w-10 h-10 rounded-full border shadow-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110"
            style={{
              backdropFilter: `blur(${appearanceSettings.blur}px)`,
              background: appearanceSettings.primaryBg,
              borderColor: appearanceSettings.borderLight,
              boxShadow: `0 4px 12px ${appearanceSettings.primaryBg}`,
            }}
            title="Configurações"
          >
            <SettingsIcon size={14} style={{ color: appearanceSettings.accentText }} />
          </button>
        </div>
      </div>
    )
  }

  const currentConv = getCurrentConversation()

  // Overlay expandido
  return (
    <>
      <div
        className="fixed pointer-events-auto"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={overlayRef}
          className="flex shadow-2xl shadow-black/50 overflow-hidden"
          style={{
            // Largura expande quando Settings está aberto (Settings fica FORA do chat)
            width: showSettings ? `${size.width + 320}px` : `${size.width}px`,
            height: `${size.height}px`,
            position: 'relative',
            background: appearanceSettings.overlayBackground,
            backdropFilter: `blur(${appearanceSettings.blur}px)`,
            borderRadius: `${appearanceSettings.radius}px`,
            border: `1px solid ${appearanceSettings.borderColor}`,
            transition: 'width 0.3s ease-in-out',
          }}
        >
          {/* Bordas de redimensionamento */}
          {/* Borda direita */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'right')}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              cursor: 'ew-resize',
              zIndex: 10,
            }}
          />
          
          {/* Borda esquerda */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'left')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              cursor: 'ew-resize',
              zIndex: 10,
            }}
          />
          
          {/* Borda superior */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'top')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              cursor: 'ns-resize',
              zIndex: 10,
            }}
          />
          
          {/* Borda inferior */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '4px',
              cursor: 'ns-resize',
              zIndex: 10,
            }}
          />
          
          {/* Cantos */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'top-left')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '8px',
              height: '8px',
              cursor: 'nw-resize',
              zIndex: 11,
            }}
          />
          
          <div
            onMouseDown={(e) => handleResizeStart(e, 'top-right')}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '8px',
              height: '8px',
              cursor: 'ne-resize',
              zIndex: 11,
            }}
          />
          
          <div
            onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '8px',
              height: '8px',
              cursor: 'sw-resize',
              zIndex: 11,
            }}
          />
          
          <div
            onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '8px',
              height: '8px',
              cursor: 'se-resize',
              zIndex: 11,
            }}
          />
          {/* Sidebar de Conversas */}
          {showSidebar && (
            <div style={{
              width: '224px',
              minWidth: '224px',
              maxWidth: '224px',
              borderRight: `1px solid ${appearanceSettings.borderLight}`,
              background: `rgba(15, 23, 42, ${appearanceSettings.opacity / 100 * 0.7})`, // slate-900
              backdropFilter: `blur(${appearanceSettings.blur}px)`,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              borderTopLeftRadius: `${appearanceSettings.radius}px`,
              borderBottomLeftRadius: `${appearanceSettings.radius}px`,
              flexShrink: 0,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${appearanceSettings.borderLight}`,
                display: 'flex',
                alignItems: 'center',
                height: '56px',
                minHeight: '56px',
                flexShrink: 0,
              }}>
                <button
                  onClick={() => {
                    createConversation('Nova Conversa')
                    setShowSidebar(false)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '12px',
                    padding: '8px 12px',
                    background: appearanceSettings.primaryBg,
                    color: appearanceSettings.accentText,
                    borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                    border: `1px solid ${appearanceSettings.borderMedium}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={12} /> Nova Conversa
                </button>
              </div>
              
              <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    style={{
                      position: 'relative',
                      fontSize: '12px',
                      padding: '8px 12px',
                      paddingRight: '28px',
                      borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                      cursor: 'pointer',
                      background: currentConversationId === conv.id
                        ? appearanceSettings.primaryBgHover
                        : 'rgba(30, 41, 59, 0.4)', // slate-800
                      color: currentConversationId === conv.id
                        ? appearanceSettings.accentText
                        : '#9ca3af',
                      border: currentConversationId === conv.id
                        ? `1px solid ${appearanceSettings.borderMedium}`
                        : '1px solid transparent',
                      width: '100%',
                      boxSizing: 'border-box',
                      flexShrink: 0,
                    }}
                    onClick={() => {
                      setCurrentConversationId(conv.id)
                    }}
                  >
                    <span style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 'calc(100% - 20px)',
                    }}>
                      {conv.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConversation(conv.id)
                      }}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f87171',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.7,
                        fontSize: '10px',
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                
                {conversations.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '12px',
                    padding: '20px 0'
                  }}>
                    Nenhuma conversa ainda
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Principal - Largura fixa, não diminui quando Settings abre */}
          <div style={{
            width: showSidebar
              ? `${size.width - 224}px`
              : `${size.width}px`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative',
          }}>
            {/* Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${appearanceSettings.borderLight}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: `linear-gradient(to right, rgba(15, 23, 42, ${appearanceSettings.opacity / 100 * 0.95}), rgba(2, 6, 23, ${appearanceSettings.opacity / 100 * 0.95}))`, // slate-900 to slate-950
                backdropFilter: `blur(${appearanceSettings.blur}px)`,
                cursor: 'move',
                userSelect: 'none',
                height: '56px',
                minHeight: '56px',
                borderTopLeftRadius: showSidebar ? '0' : `${appearanceSettings.radius}px`,
                // Quando Settings está aberto, não arredondar a direita pois o Settings continua
                borderTopRightRadius: showSettings ? '0' : `${appearanceSettings.radius}px`,
              }}
              onMouseDown={handleDragStart}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: appearanceSettings.primaryBg,
                    color: '#9ca3af',
                    borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                    border: `1px solid ${appearanceSettings.borderLight}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  title="Conversas"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Menu size={16} />
                </button>
                <h2 style={{ color: appearanceSettings.accentText, fontWeight: 600, fontSize: '14px' }}>
                  {currentConv?.title || 'AI Agent'}
                </h2>
              </div>
              
              <div className="flex gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
                {/* Seletor de Monitor - Sempre visível */}
                <div style={{ position: 'relative' }} data-monitor-dropdown>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowDisplaySelector(!showDisplaySelector)
                      }}
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: appearanceSettings.primaryBg,
                        color: '#9ca3af',
                        borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                        border: `1px solid ${appearanceSettings.borderLight}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      title={`Monitor ${currentDisplayId} (${availableDisplays.length} disponíveis)`}
                    >
                      <Monitor size={16} />
                    </button>
                    
                    {/* Dropdown de monitores */}
                    {showDisplaySelector && (
                      <div
                        data-monitor-dropdown
                        style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '4px',
                        background: `rgba(15, 23, 42, ${Math.max(0.9, appearanceSettings.opacity / 100)})`, // slate-900 com opacidade mínima
                        border: `1px solid ${appearanceSettings.borderMedium}`,
                        borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                        padding: '8px',
                        minWidth: '200px',
                        zIndex: 1000,
                        backdropFilter: `blur(${appearanceSettings.blur}px)`,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          color: appearanceSettings.accentText,
                          marginBottom: '8px',
                          fontWeight: 600
                        }}>
                          Selecionar Monitor
                        </div>
                        {availableDisplays.map((display: any, index: number) => (
                          <button
                            key={display.id}
                            data-monitor-dropdown
                            onClick={(e) => {
                              e.stopPropagation()
                              switchToDisplay(display.id)
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 12px',
                              marginBottom: '4px',
                              background: currentDisplayId === display.id
                                ? appearanceSettings.primaryBgHover
                                : 'rgba(30, 41, 59, 0.5)', // slate-800
                              color: currentDisplayId === display.id
                                ? appearanceSettings.accentText
                                : '#d1d5db',
                              border: currentDisplayId === display.id
                                ? `1px solid ${appearanceSettings.borderStrong}`
                                : '1px solid transparent',
                              borderRadius: `${Math.min(appearanceSettings.radius, 6)}px`,
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <Monitor size={14} />
                            <div>
                              <div style={{ fontWeight: 500 }}>
                                Monitor {index + 1} {display.internal ? '(Interno)' : '(Externo)'}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: currentDisplayId === display.id ? appearanceSettings.accentText : '#9ca3af'
                              }}>
                                {display.size.width}x{display.size.height} @ {display.bounds.x},{display.bounds.y}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
               </div>
               
               {/* Botão Toggle Visibilidade em Capturas */}
               <button
                  onClick={() => setIsVisibleInCaptures(!isVisibleInCaptures)}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isVisibleInCaptures
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                    color: isVisibleInCaptures ? '#86efac' : '#fca5a5',
                    borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                    border: `1px solid ${isVisibleInCaptures
                      ? 'rgba(34, 197, 94, 0.3)'
                      : 'rgba(239, 68, 68, 0.3)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  title={isVisibleInCaptures
                    ? 'Visível em capturas (clique para ocultar)'
                    : 'Oculto em capturas (clique para mostrar)'}
                >
                  {isVisibleInCaptures ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
               
               {/* Botão Exportar Conversa */}
               <button
                  onClick={() => {
                    if (messages.length > 0) {
                      const title = currentConv?.title || 'Conversa'
                      const markdown = exportAsMarkdown(messages, title)
                      const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.md`
                      downloadAsFile(markdown, filename, 'markdown')
                      setStatusMessage('✅ Conversa exportada com sucesso!')
                      setTimeout(() => setStatusMessage(''), 3000)
                    } else {
                      setStatusMessage('⚠️ Nenhuma mensagem para exportar')
                      setTimeout(() => setStatusMessage(''), 3000)
                    }
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: appearanceSettings.primaryBg,
                    color: messages.length > 0 ? '#9ca3af' : '#4b5563',
                    borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                    border: `1px solid ${appearanceSettings.borderLight}`,
                    cursor: messages.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    opacity: messages.length > 0 ? 1 : 0.5,
                  }}
                  title={messages.length > 0
                    ? 'Exportar conversa em Markdown'
                    : 'Nenhuma mensagem para exportar'}
                  disabled={messages.length === 0}
                >
                  <Download size={16} />
                </button>
               
               <button
                  onClick={() => setShowSettings(true)}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: appearanceSettings.primaryBg,
                    color: '#9ca3af',
                    borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                    border: `1px solid ${appearanceSettings.borderLight}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  title="Configurações"
                >
                  <SettingsIcon size={16} />
                </button>
                <button
                   onClick={handleMinimize}
                   style={{
                     width: '32px',
                     height: '32px',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     background: 'rgba(234, 88, 12, 0.2)',
                     color: '#fb923c',
                     borderRadius: `${Math.min(appearanceSettings.radius, 8)}px`,
                     border: '1px solid rgba(234, 88, 12, 0.3)',
                     cursor: 'pointer',
                     transition: 'all 0.2s',
                   }}
                   title="Minimizar (Ctrl+Alt+A)"
                 >
                   <Minus size={16} />
                 </button>
              </div>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div style={{
                padding: '10px 16px',
                background: appearanceSettings.primaryBg,
                borderBottom: `1px solid ${appearanceSettings.borderLight}`,
                color: appearanceSettings.accentText,
                fontSize: '14px',
              }}>
                {statusMessage}
              </div>
            )}

            {/* Transcription Status - Separado da gravação */}
            {transcriptionStatus && (
              <div style={{
                padding: '8px 16px',
                background: 'rgba(139, 92, 246, 0.2)',
                borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
                color: '#c4b5fd',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Mic size={12} /> {transcriptionStatus}
              </div>
            )}

            {/* Audio Error */}
            {audioError && (
              <div style={{
                padding: '10px 16px',
                background: 'rgba(127, 29, 29, 0.3)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Mic size={14} /> {audioError}
              </div>
            )}

            {/* Recording Indicator - Captura de Áudio do Sistema */}
            {isRecording && (
              <div style={{
                padding: '10px 16px',
                background: 'linear-gradient(to right, rgba(127, 29, 29, 0.4), rgba(154, 52, 18, 0.3))',
                borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      animation: 'pulse 1s infinite',
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                    }}></span>
                    <span style={{
                      color: '#fca5a5',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <Volume2 size={12} />
                      {isPaused ? 'Pausado' : 'Gravando'}
                      
                      {/* Indicador de fontes de áudio */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                        {/* Sistema */}
                        <span style={{
                          fontSize: '10px',
                          color: systemAudioActive ? '#67e8f9' : '#6b7280',
                          fontWeight: 500,
                          padding: '2px 4px',
                          borderRadius: '3px',
                          background: systemAudioActive ? 'rgba(6, 182, 212, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}>
                          <Computer size={8} /> SYS
                        </span>
                        
                        {/* Microfone */}
                        {enableMicrophoneValue && (
                          <span style={{
                            fontSize: '10px',
                            color: microphoneActive ? '#f87171' : '#6b7280',
                            fontWeight: 500,
                            padding: '2px 4px',
                            borderRadius: '3px',
                            background: microphoneActive ? 'rgba(248, 113, 113, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}>
                            <Mic size={8} /> MIC
                          </span>
                        )}
                        
                        {/* Modo */}
                        <span style={{
                          fontSize: '10px',
                          color: infiniteLoopValue ? '#86efac' : '#fbbf24',
                          fontWeight: 500,
                          padding: '2px 4px',
                          borderRadius: '3px',
                          background: infiniteLoopValue ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}>
                          {infiniteLoopValue ? <InfinityIcon size={8} /> : <Square size={6} />}
                          {infiniteLoopValue ? '' : '1x'}
                        </span>
                      </div>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {isPaused ? (
                      <button
                        onClick={resumeRecording}
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(22, 163, 74, 0.5)',
                          color: '#bbf7d0',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Play size={10} /> Retomar
                      </button>
                    ) : (
                      <button
                        onClick={pauseRecording}
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(202, 138, 4, 0.5)',
                          color: '#fef08a',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Pause size={10} /> Pausar
                      </button>
                    )}
                    <button
                      onClick={stopRecording}
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(37, 99, 235, 0.5)',
                        color: '#bfdbfe',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Square size={10} /> Parar
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
                  <span style={{ color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} /> {formatDuration(duration)}
                  </span>
                  <span style={{ color: '#fdba74', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Package size={10} /> {currentChunkDuration}s/{Math.floor(maxChunkDurationValue / 1000)}s
                  </span>
                  {chunksProcessed > 0 && (
                    <span style={{ color: '#86efac', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={10} /> {chunksProcessed}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Messages Container */}
            <div
              ref={responseRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                background: `rgba(2, 6, 23, ${appearanceSettings.opacity / 100 * 0.6})`, // slate-950
              }}
            >
              {messages.length === 0 && !currentResponse && (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                    <Bot size={48} style={{ color: appearanceSettings.primaryBgStrong }} />
                  </div>
                  <p style={{ fontSize: '14px', marginBottom: '12px' }}>Inicie uma conversa ou capture uma screenshot</p>
                  <p style={{ fontSize: '12px', color: appearanceSettings.accentText, opacity: 0.7, marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Camera size={12} /> Ctrl+Alt+S para capturar tela
                  </p>
                  <p style={{ fontSize: '12px', color: appearanceSettings.accentText, opacity: 0.7, marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Volume2 size={12} /> Ctrl+Alt+R para gravar áudio do sistema
                  </p>
                  <p style={{ fontSize: '12px', color: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Mic size={12} /> Captura áudio de aulas, meetings, etc
                  </p>
                  <p style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: '4px' }}>
                    Modo {infiniteLoopValue ? 'infinito' : 'único'} • {enableMicrophoneValue ? 'Sistema + Microfone' : 'Apenas Sistema'}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.map((msg) => {
                  // Parsear metadados se existirem
                  const metadata = msg.metadata ? (typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata) : null
                  
                  // Formatar timestamp (created_at é number em ms)
                  const formatTimestamp = (timestamp: number | string | undefined) => {
                    if (!timestamp || timestamp === 0) {
                      return '--:--'
                    }
                    const date = new Date(timestamp)
                    if (isNaN(date.getTime())) {
                      return '--:--'
                    }
                    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  }
                  
                  const isUserMessage = msg.role === 'user'
                  
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: isUserMessage ? 'flex-end' : 'flex-start',
                        marginBottom: '4px'
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '85%',
                          padding: '14px 18px',
                          paddingBottom: '8px',
                          borderRadius: isUserMessage
                            ? `${Math.min(appearanceSettings.radius, 16)}px ${Math.min(appearanceSettings.radius, 16)}px 4px ${Math.min(appearanceSettings.radius, 16)}px`
                            : `${Math.min(appearanceSettings.radius, 16)}px ${Math.min(appearanceSettings.radius, 16)}px ${Math.min(appearanceSettings.radius, 16)}px 4px`,
                          fontSize: '14px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          background: isUserMessage
                            ? appearanceSettings.buttonGradient
                            : `rgba(30, 41, 59, ${Math.max(0.7, appearanceSettings.opacity / 100 * 0.9)})`, // slate-800 com opacidade mínima
                          color: isUserMessage ? '#e0f2fe' : '#f3f4f6',
                          marginLeft: isUserMessage ? '16px' : '0',
                          marginRight: isUserMessage ? '0' : '16px',
                        }}
                      >
                        {/* Usar Streamdown para renderizar markdown nas mensagens da IA */}
                        {!isUserMessage ? (
                          <Streamdown
                            mode="static"
                            parseIncompleteMarkdown={true}
                            className="prose prose-sm prose-invert max-w-none"
                            components={{
                              ul: ({ children }) => (
                                <ul style={{
                                  listStyleType: 'disc',
                                  listStylePosition: 'outside',
                                  paddingLeft: '1.5rem',
                                  margin: '0.125rem 0',
                                  display: 'block'
                                }}>
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol style={{
                                  listStyleType: 'decimal',
                                  listStylePosition: 'outside',
                                  paddingLeft: '1.5rem',
                                  margin: '0.125rem 0',
                                  display: 'block'
                                }}>
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li style={{
                                  display: 'list-item',
                                  margin: '0',
                                  padding: '0',
                                  lineHeight: '1.3',
                                  whiteSpace: 'normal'
                                }}>
                                  <span style={{ display: 'inline' }}>{children}</span>
                                </li>
                              )
                            }}
                          >
                            {msg.content}
                          </Streamdown>
                        ) : (
                          renderMessageContent(msg.content)
                        )}
                        
                        {/* Footer com metadados: timestamp, tokens, custo */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '8px',
                          paddingTop: '6px',
                          borderTop: `1px solid ${isUserMessage ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                          fontSize: '10px',
                          color: isUserMessage ? 'rgba(224, 242, 254, 0.6)' : '#6b7280',
                          flexWrap: 'wrap',
                        }}>
                          {/* Timestamp */}
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={10} />
                            {formatTimestamp(msg.created_at)}
                          </span>
                          
                          {/* Tokens (apenas para mensagens da IA) */}
                          {!isUserMessage && metadata?.tokens && (
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '1px 4px',
                              background: appearanceSettings.primaryBg,
                              borderRadius: '3px',
                            }}>
                              <Zap size={10} />
                              {metadata.tokens.toLocaleString()} tokens
                            </span>
                          )}
                          
                          {/* Custo (apenas para mensagens da IA) */}
                          {!isUserMessage && metadata?.cost && metadata.cost > 0 && (
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '1px 4px',
                              background: appearanceSettings.primaryBg,
                              borderRadius: '3px',
                            }}>
                              <DollarSign size={10} />
                              ${metadata.cost.toFixed(4)}
                            </span>
                          )}
                          
                          {/* Modelo usado */}
                          {!isUserMessage && metadata?.model && (
                            <span style={{
                              opacity: 0.7,
                              fontSize: '9px',
                            }}>
                              {metadata.model}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {currentResponse && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '4px' }}>
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '14px 18px',
                        borderRadius: '16px 16px 16px 4px',
                        background: 'rgba(30, 41, 59, 0.8)', // slate-800
                        color: '#f3f4f6',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        marginRight: '16px',
                      }}
                    >
                      {/* Usar Streamdown para streaming em tempo real */}
                      <Streamdown
                        mode="streaming"
                        isAnimating={true}
                        parseIncompleteMarkdown={true}
                        className="prose prose-sm prose-invert max-w-none"
                        components={{
                          ul: ({ children }) => (
                            <ul style={{
                              listStyleType: 'disc',
                              listStylePosition: 'outside',
                              paddingLeft: '1.5rem',
                              margin: '0.125rem 0'
                            }}>
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol style={{
                              listStyleType: 'decimal',
                              listStylePosition: 'outside',
                              paddingLeft: '1.5rem',
                              margin: '0.125rem 0'
                            }}>
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li style={{
                              display: 'list-item',
                              margin: '0',
                              padding: '0',
                              lineHeight: '1.3',
                              whiteSpace: 'normal'
                            }}>
                              <span style={{ display: 'inline' }}>{children}</span>
                            </li>
                          )
                        }}
                      >
                        {currentResponse}
                      </Streamdown>
                    </div>
                  </div>
                )}

                {error && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '12px',
                        background: 'rgba(127, 29, 29, 0.4)',
                        color: '#fca5a5',
                        fontSize: '14px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AlertCircle size={16} /> {error}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div style={{
              padding: '16px 20px',
              borderTop: `1px solid ${appearanceSettings.borderLight}`,
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              background: `rgba(15, 23, 42, ${appearanceSettings.opacity / 100 * 0.7})`, // slate-900
              backdropFilter: `blur(${appearanceSettings.blur}px)`,
            }}>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: `${Math.min(appearanceSettings.radius, 12)}px`,
                  border: isRecording ? '1px solid rgba(239, 68, 68, 0.5)' : `1px solid ${appearanceSettings.borderLight}`,
                  background: isRecording ? 'rgba(220, 38, 38, 0.6)' : appearanceSettings.primaryBg,
                  color: isRecording ? '#fecaca' : '#9ca3af',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title={isRecording
                  ? 'Parar captura de áudio'
                  : `Capturar áudio ${enableMicrophoneValue ? '(Sistema + Microfone)' : '(Sistema)'} - Modo ${infiniteLoopValue ? 'Infinito' : 'Único'} (Ctrl+Alt+R)`
                }
              >
                {isRecording ? <Square size={18} /> : <Volume2 size={18} />}
              </button>

              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Digite sua mensagem..."
                disabled={isLoading || isRecording}
                style={{
                  flex: 1,
                  background: `rgba(2, 6, 23, ${Math.max(0.7, appearanceSettings.opacity / 100 * 0.9)})`, // slate-950
                  border: `1px solid ${appearanceSettings.borderLight}`,
                  borderRadius: `${Math.min(appearanceSettings.radius, 12)}px`,
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#e5e7eb',
                  outline: 'none',
                }}
              />
              
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !userInput.trim() || isRecording}
                style={{
                  padding: '12px 16px',
                  background: appearanceSettings.buttonGradient,
                  color: '#e0f2fe',
                  borderRadius: `${Math.min(appearanceSettings.radius, 12)}px`,
                  border: `1px solid ${appearanceSettings.borderMedium}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isLoading || !userInput.trim() || isRecording ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !userInput.trim() || isRecording ? 0.4 : 1,
                  flexShrink: 0,
                }}
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>

            {/* Status Bar */}
            <div style={{
              padding: '8px 12px',
              borderTop: `1px solid ${appearanceSettings.borderLight}`,
              background: `rgba(2, 6, 23, ${appearanceSettings.opacity / 100 * 0.9})`, // slate-950
              fontSize: '10px',
              color: '#9ca3af',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomLeftRadius: showSidebar ? '0' : `${appearanceSettings.radius}px`,
              borderBottomRightRadius: showSettings ? '0' : `${appearanceSettings.radius}px`,
              gap: '8px',
            }}>
              {/* Lado esquerdo: Mensagens, Tokens e Custo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                <span>{messages.length} msgs</span>
                
                {/* Tokens Info - usando cores do tema */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  background: tokenStats.estimatedContextTokens > tokenStats.contextLimit * 0.8
                    ? 'rgba(239, 68, 68, 0.2)'
                    : tokenStats.estimatedContextTokens > tokenStats.contextLimit * 0.5
                      ? 'rgba(245, 158, 11, 0.2)'
                      : appearanceSettings.primaryBg,
                  borderRadius: '4px',
                  border: `1px solid ${tokenStats.estimatedContextTokens > tokenStats.contextLimit * 0.8
                    ? 'rgba(239, 68, 68, 0.3)'
                    : tokenStats.estimatedContextTokens > tokenStats.contextLimit * 0.5
                      ? 'rgba(245, 158, 11, 0.3)'
                      : appearanceSettings.borderLight}`,
                }}>
                  <Zap size={10} style={{
                    color: tokenStats.estimatedContextTokens > tokenStats.contextLimit * 0.8
                      ? '#fca5a5'
                      : tokenStats.estimatedContextTokens > tokenStats.contextLimit * 0.5
                        ? '#fbbf24'
                        : appearanceSettings.accentText
                  }} />
                  <span style={{
                    color: tokenStats.estimatedContextTokens > tokenStats.contextLimit * 0.8
                      ? '#fca5a5'
                      : tokenStats.estimatedContextTokens > tokenStats.contextLimit * 0.5
                        ? '#fbbf24'
                        : appearanceSettings.accentText,
                    fontWeight: 500,
                  }}>
                    ~{(tokenStats.estimatedContextTokens / 1000).toFixed(1)}k
                  </span>
                  <span style={{ color: '#6b7280' }}>/</span>
                  <span style={{ color: '#6b7280' }}>
                    {(tokenStats.contextLimit / 1000).toFixed(0)}k
                  </span>
                </div>

                {/* Custo Total - usando cores do tema */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    background: appearanceSettings.primaryBg,
                    borderRadius: '4px',
                    border: `1px solid ${appearanceSettings.borderLight}`,
                    cursor: 'help',
                  }}
                  title={`Chat: $${costStats.chatCost.toFixed(4)}\nÁudio: $${costStats.audioCost.toFixed(4)} (${costStats.audioMinutes.toFixed(1)} min)\nImagens: $${costStats.imageCost.toFixed(4)} (${costStats.imagesAnalyzed} imgs)\n\nRequisições: ${costStats.requestCount}`}
                >
                  <DollarSign size={10} style={{ color: appearanceSettings.accentText }} />
                  <span style={{
                    color: appearanceSettings.accentText,
                    fontWeight: 500,
                  }}>
                    ${costStats.totalCost.toFixed(4)}
                  </span>
                </div>

                {/* Botão Condensar - usando cores do tema */}
                {messages.length > 4 && (
                  <button
                    onClick={async () => {
                      if (isCondensing) return
                      setStatusMessage('🔄 Condensando contexto...')
                      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }))
                      const condensed = await condenseContextManually(apiMessages)
                      if (condensed.length < messages.length) {
                        setStatusMessage(`✅ Contexto condensado: ${messages.length} → ${condensed.length} mensagens`)
                      } else {
                        setStatusMessage('ℹ️ Contexto já está otimizado')
                      }
                      setTimeout(() => setStatusMessage(''), 3000)
                    }}
                    disabled={isCondensing || messages.length <= 4}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 6px',
                      background: appearanceSettings.primaryBg,
                      border: `1px solid ${appearanceSettings.borderLight}`,
                      borderRadius: '4px',
                      color: appearanceSettings.accentText,
                      cursor: isCondensing ? 'wait' : 'pointer',
                      fontSize: '10px',
                      opacity: isCondensing ? 0.6 : 1,
                    }}
                    title="Condensar contexto (resumir mensagens antigas)"
                  >
                    {isCondensing ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Shrink size={10} />
                    )}
                    <span>Condensar</span>
                  </button>
                )}

                {/* Detalhes de custo por tipo (compacto) */}
                {(costStats.audioCost > 0 || costStats.imageCost > 0) && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '9px',
                    color: '#6b7280',
                  }}>
                    {costStats.audioCost > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Mic size={8} />
                        ${costStats.audioCost.toFixed(3)}
                      </span>
                    )}
                    {costStats.imageCost > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Image size={8} />
                        ${costStats.imageCost.toFixed(3)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Lado direito: Cache e Modelo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {tokenStats.cachedTokens && tokenStats.cachedTokens > 0 && (
                  <span style={{
                    color: appearanceSettings.accentText,
                    fontSize: '9px',
                    padding: '1px 4px',
                    background: appearanceSettings.primaryBg,
                    borderRadius: '3px',
                    border: `1px solid ${appearanceSettings.borderLight}`,
                  }}>
                    💾 {(tokenStats.cachedTokens / 1000).toFixed(1)}k
                  </span>
                )}
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: appearanceSettings.primaryColor,
                  animation: 'pulse 1s infinite',
                }}></span>
                <span style={{ fontWeight: 500, color: appearanceSettings.accentText }}>{settings?.model || 'GPT-4o'}</span>
              </div>
            </div>
          </div>

          {/* Painel Settings do lado direito */}
          {showSettings && (
            <Settings
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              settings={settings}
              onSave={setSetting}
            />
          )}
        </div>
      </div>

      {/* Modal de Configurações - Removido para implementar como painel lateral */}

      {/* Modal de Preview de Screenshot - VERSÃO COM FORÇA BRUTA */}
      {screenshotPreview && (
        <>
          {/* Forçar eventos do mouse quando modal está aberto */}
          {(() => {
            console.log('Modal aberto, forçando eventos do mouse')
            toggleMouseEvents(false)
            return null
          })()}
          
          <div
            onMouseDown={(e) => {
              console.log('MouseDown no modal')
              e.preventDefault()
              e.stopPropagation()
              setScreenshotPreview(null)
            }}
            onClick={(e) => {
              console.log('Click no modal')
              e.preventDefault()
              e.stopPropagation()
              setScreenshotPreview(null)
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              cursor: 'pointer',
            }}
          >
            <div
              style={{ textAlign: 'center', position: 'relative' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Botão de fechar sutil */}
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setScreenshotPreview(null)
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setScreenshotPreview(null)
                }}
                style={{
                  position: 'absolute',
                  top: '-16px',
                  right: '-16px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(55, 65, 81, 0.9)',
                  color: '#f3f4f6',
                  border: '2px solid rgba(6, 182, 212, 0.5)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  zIndex: 1000000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)'
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.8)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(55, 65, 81, 0.9)'
                  e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.5)'
                }}
              >
                ✕
              </button>
              
              <img
                src={`data:image/jpeg;base64,${screenshotPreview}`}
                alt="Screenshot Preview"
                style={{
                  maxWidth: '90vw',
                  maxHeight: '80vh',
                  borderRadius: '12px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  cursor: 'default',
                  pointerEvents: 'none',
                }}
              />
              
              <div style={{
                marginTop: '16px',
                color: '#9ca3af',
                fontSize: '14px',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '8px 16px',
                borderRadius: '8px',
                display: 'inline-block',
              }}>
                Clique fora da imagem para fechar
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

