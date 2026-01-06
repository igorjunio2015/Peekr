/**
 * Hook para captura combinada de áudio do sistema + microfone
 * Mixa os dois áudios em tempo real e envia chunks automaticamente
 * Suporta modo infinito e único
 */

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseCombinedAudioOptions {
  silenceThreshold?: number // Nível de volume considerado silêncio (0-1)
  silenceDuration?: number // Duração do silêncio para considerar pausa (ms)
  maxChunkDuration?: number // Duração máxima de cada chunk (ms)
  onChunkReady?: (blob: Blob) => void // Callback quando um chunk está pronto
  infiniteLoop?: boolean // Se true, continua gravando infinitamente
  enableMicrophone?: boolean // Se true, inclui microfone na gravação
  microphoneDeviceId?: string // ID do dispositivo de microfone
}

interface UseCombinedAudioReturn {
  isCapturing: boolean
  isPaused: boolean
  duration: number
  currentChunkDuration: number
  chunksProcessed: number
  systemAudioActive: boolean
  microphoneActive: boolean
  error: string | null
  startCapture: () => Promise<void>
  stopCapture: () => void
  pauseCapture: () => void
  resumeCapture: () => void
  formatDuration: (seconds: number) => string
}

export const useCombinedAudio = (options: UseCombinedAudioOptions = {}): UseCombinedAudioReturn => {
  const {
    silenceThreshold = 0.01,
    silenceDuration = 2000,
    maxChunkDuration = 30000,
    onChunkReady,
    infiniteLoop = true,
    enableMicrophone = false,
    microphoneDeviceId = 'default',
  } = options

  const [isCapturing, setIsCapturing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentChunkDuration, setCurrentChunkDuration] = useState(0)
  const [chunksProcessed, setChunksProcessed] = useState(0)
  const [systemAudioActive, setSystemAudioActive] = useState(false)
  const [microphoneActive, setMicrophoneActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs para controle
  const systemStreamRef = useRef<MediaStream | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const combinedStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const chunkStartTimeRef = useRef<number>(0)
  const isCapturingRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)
  const maxChunkDurationRef = useRef<number>(maxChunkDuration)
  const currentMimeTypeRef = useRef<string>('audio/webm;codecs=opus')
  const shouldRestartRef = useRef<boolean>(false)

  // Atualizar ref quando prop mudar
  useEffect(() => {
    maxChunkDurationRef.current = maxChunkDuration
  }, [maxChunkDuration])

  // Formatar duração em MM:SS
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Processar e enviar o chunk finalizado
  const processFinalizedChunk = useCallback(() => {
    if (chunksRef.current.length === 0) {
      console.log('[CombinedAudio] Nenhum dado para enviar')
      return
    }

    // Verificar duração do chunk para validação
    const now = Date.now()
    const chunkDuration = now - chunkStartTimeRef.current
    
    // Usar o tipo MIME que foi usado na gravação
    const mimeType = currentMimeTypeRef.current
    const blob = new Blob(chunksRef.current, { type: mimeType })
    console.log('[CombinedAudio] ✅ Chunk processado:', blob.size, 'bytes, duração:', Math.floor(chunkDuration/1000) + 's, tipo:', mimeType)
    
    // Validação rigorosa: tamanho mínimo E duração mínima
    const minSize = 5000 // 5KB mínimo
    const minDuration = 1000 // 1 segundo mínimo
    
    if (blob.size > minSize && chunkDuration > minDuration && onChunkReady) {
      console.log('[CombinedAudio] 📤 Enviando chunk #' + (chunksProcessed + 1) + ' para transcrição...')
      setChunksProcessed(prev => prev + 1)
      onChunkReady(blob)
    } else {
      console.log('[CombinedAudio] ⚠️ Chunk inválido - tamanho:', blob.size, 'duração:', Math.floor(chunkDuration/1000) + 's - ignorando')
    }
    
    // Limpar chunks
    chunksRef.current = []
  }, [onChunkReady, chunksProcessed])

  // Verificar se deve enviar chunk
  const checkAndSendChunk = useCallback(() => {
    if (!isCapturingRef.current || isPausedRef.current) return

    const now = Date.now()
    const chunkDuration = now - chunkStartTimeRef.current
    const maxDuration = maxChunkDurationRef.current
    
    // Atualizar duração atual do chunk
    setCurrentChunkDuration(Math.floor(chunkDuration / 1000))

    // Envia quando atinge o tempo máximo configurado
    if (chunkDuration >= maxDuration) {
      console.log(`[CombinedAudio] ⏰ Tempo limite atingido (${Math.floor(maxDuration/1000)}s) - reiniciando gravador...`)
      
      if (infiniteLoop) {
        // Marcar para reiniciar
        shouldRestartRef.current = true
        // Parar o gravador atual força a finalização do arquivo com cabeçalhos corretos
        // O reinício acontecerá no evento 'stop' do MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      } else {
        // Modo único: apenas parar
        shouldRestartRef.current = false
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
        // Parar tudo após um pequeno delay
        setTimeout(() => {
          if (isCapturingRef.current) {
            stopCapture()
          }
        }, 100)
      }
      return
    }

    // Log de progresso a cada 5 segundos
    if (chunkDuration > 0 && Math.floor(chunkDuration / 5000) > Math.floor((chunkDuration - 500) / 5000)) {
      const remaining = Math.max(0, Math.floor((maxDuration - chunkDuration) / 1000))
      const mode = infiniteLoop ? 'infinito' : 'único'
      const sources = enableMicrophone ? 'sistema+mic' : 'sistema'
      console.log(`[CombinedAudio] 📊 Gravando (${mode}, ${sources})... ${Math.floor(chunkDuration/1000)}s/${Math.floor(maxDuration/1000)}s (${remaining}s restantes)`)
    }
  }, [infiniteLoop, enableMicrophone])

  // Declaração antecipada da função stopCapture
  const stopCapture = useCallback(() => {
    console.log('[CombinedAudio] Parando captura...')
    
    isCapturingRef.current = false
    shouldRestartRef.current = false // Garantir que não reinicie
    isPausedRef.current = false

    // Parar intervalos primeiro
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    // Parar MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // Parar streams
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(track => track.stop())
      systemStreamRef.current = null
      setSystemAudioActive(false)
    }

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop())
      microphoneStreamRef.current = null
      setMicrophoneActive(false)
    }

    if (combinedStreamRef.current) {
      combinedStreamRef.current.getTracks().forEach(track => track.stop())
      combinedStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsCapturing(false)
    setIsPaused(false)
    console.log('[CombinedAudio] Captura parada')
  }, [])

  // Iniciar captura combinada
  const startCapture = useCallback(async () => {
    try {
      // Se já estiver capturando e for apenas um reinício de gravador, não recriar streams
      const isRestart = isCapturingRef.current && shouldRestartRef.current
      
      if (!isRestart) {
        setError(null)
        setChunksProcessed(0)
        console.log('[CombinedAudio] Iniciando captura combinada...')
        console.log('[CombinedAudio] Microfone:', enableMicrophone ? 'ATIVADO' : 'DESATIVADO')
        
        // Criar AudioContext para mixagem
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        
        // Capturar áudio do sistema
        console.log('[CombinedAudio] Capturando áudio do sistema...')
        // @ts-ignore
        const systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1, height: 1, frameRate: 1 },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })

        const systemAudioTracks = systemStream.getAudioTracks()
        if (systemAudioTracks.length === 0) {
          systemStream.getVideoTracks().forEach(track => track.stop())
          throw new Error('Nenhum áudio do sistema disponível. Compartilhe uma aba/janela com áudio.')
        }

        // Parar vídeo, manter apenas áudio
        systemStream.getVideoTracks().forEach(track => track.stop())
        const systemAudioStream = new MediaStream(systemAudioTracks)
        systemStreamRef.current = systemAudioStream
        setSystemAudioActive(true)

        // Criar fonte de áudio do sistema
        const systemSource = audioContext.createMediaStreamSource(systemAudioStream)
        
        // Criar destino para stream combinado
        const destination = audioContext.createMediaStreamDestination()
        
        // Criar nós de ganho para equalização
        const systemGain = audioContext.createGain()
        const microphoneGain = audioContext.createGain()
        
        // Configurar ganhos para equalização balanceada
        systemGain.gain.value = 1.0
        microphoneGain.gain.value = 0.4
        
        // Conectar áudio do sistema com ganho
        systemSource.connect(systemGain)
        systemGain.connect(destination)
        
        // Capturar microfone se habilitado
        if (enableMicrophone) {
          try {
            console.log('[CombinedAudio] Capturando microfone...')
            const microphoneStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: microphoneDeviceId !== 'default' ? { exact: microphoneDeviceId } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            })
            
            microphoneStreamRef.current = microphoneStream
            setMicrophoneActive(true)
            
            // Criar fonte de microfone e conectar com ganho reduzido
            const microphoneSource = audioContext.createMediaStreamSource(microphoneStream)
            microphoneSource.connect(microphoneGain)
            microphoneGain.connect(destination)
            
            console.log('[CombinedAudio] ✅ Microfone conectado com equalização (sistema: 100%, microfone: 40%)')
          } catch (micError) {
            console.warn('[CombinedAudio] ⚠️ Erro ao capturar microfone:', micError)
            setMicrophoneActive(false)
          }
        }

        // Stream combinado
        const combinedStream = destination.stream
        combinedStreamRef.current = combinedStream
      }

      // Configurar MediaRecorder (sempre recriado para garantir novos cabeçalhos)
      if (!combinedStreamRef.current) throw new Error('Stream combinado não disponível')

      let mimeType = 'audio/webm;codecs=opus'
      let recorderOptions: MediaRecorderOptions = { mimeType }
      
      // Tentar formatos em ordem de preferência para Whisper
      const preferredFormats = [
        'audio/wav',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ]
      
      for (const format of preferredFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format
          recorderOptions = { mimeType: format }
          console.log('[CombinedAudio] Usando formato:', format)
          break
        }
      }
      
      currentMimeTypeRef.current = mimeType
      
      const mediaRecorder = new MediaRecorder(combinedStreamRef.current, recorderOptions)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      // Evento STOP é crucial para o loop infinito
      mediaRecorder.onstop = () => {
        console.log('[CombinedAudio] MediaRecorder parou. Processando chunk...')
        
        // Processar o chunk acumulado (agora é um arquivo completo)
        processFinalizedChunk()
        
        // Se deve reiniciar (loop infinito), inicia novo gravador
        if (shouldRestartRef.current && isCapturingRef.current) {
          console.log('[CombinedAudio] 🔄 Reiniciando gravador para próximo chunk...')
          startCapture() // Recursão controlada
        }
      }

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      chunkStartTimeRef.current = Date.now()

      // Iniciar gravação
      mediaRecorder.start(1000)
      console.log('[CombinedAudio] MediaRecorder iniciado')

      if (!isRestart) {
        isCapturingRef.current = true
        isPausedRef.current = false
        setIsCapturing(true)
        setIsPaused(false)
        setDuration(0)
        setCurrentChunkDuration(0)

        // Contador de duração total
        durationIntervalRef.current = setInterval(() => {
          setDuration(prev => prev + 1)
        }, 1000)

        // Verificação de chunks a cada 500ms
        chunkIntervalRef.current = setInterval(checkAndSendChunk, 500)

        const sources = enableMicrophone ? 'sistema + microfone' : 'apenas sistema'
        console.log(`[CombinedAudio] ✅ Captura iniciada com sucesso! (${sources})`)
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao capturar áudio'
      setError(errorMessage)
      setSystemAudioActive(false)
      setMicrophoneActive(false)
      console.error('[CombinedAudio] Erro:', err)
    }
  }, [checkAndSendChunk, enableMicrophone, microphoneDeviceId, processFinalizedChunk, stopCapture])

  // Pausar captura
  const pauseCapture = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      isPausedRef.current = true
      setIsPaused(true)
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
      console.log('[CombinedAudio] Captura pausada')
    }
  }, [])

  // Retomar captura
  const resumeCapture = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      isPausedRef.current = false
      setIsPaused(false)
      
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
      console.log('[CombinedAudio] Captura retomada')
    }
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (isCapturingRef.current) {
        stopCapture()
      }
    }
  }, [stopCapture])

  return {
    isCapturing,
    isPaused,
    duration,
    currentChunkDuration,
    chunksProcessed,
    systemAudioActive,
    microphoneActive,
    error,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
    formatDuration,
  }
}
