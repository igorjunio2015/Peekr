/**
 * Hook para captura de áudio do SISTEMA (não microfone)
 * Captura áudio de aulas, meetings, vídeos, etc.
 * Envia chunks automaticamente no tempo configurado
 * Continua gravando até o usuário cancelar
 */

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseSystemAudioOptions {
  silenceThreshold?: number // Nível de volume considerado silêncio (0-1)
  silenceDuration?: number // Duração do silêncio para considerar pausa (ms)
  maxChunkDuration?: number // Duração máxima de cada chunk (ms) - até 60000 (60s)
  onChunkReady?: (blob: Blob) => void // Callback quando um chunk está pronto
  infiniteLoop?: boolean // Se true, continua gravando infinitamente; se false, para após o primeiro chunk
}

interface UseSystemAudioReturn {
  isCapturing: boolean
  isPaused: boolean
  duration: number
  currentChunkDuration: number
  chunksProcessed: number
  error: string | null
  startCapture: () => Promise<void>
  stopCapture: () => void
  pauseCapture: () => void
  resumeCapture: () => void
  formatDuration: (seconds: number) => string
}

export const useSystemAudio = (options: UseSystemAudioOptions = {}): UseSystemAudioReturn => {
  const {
    silenceThreshold = 0.01,
    silenceDuration = 2000,
    maxChunkDuration = 30000,
    onChunkReady,
    infiniteLoop = true,
  } = options

  const [isCapturing, setIsCapturing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentChunkDuration, setCurrentChunkDuration] = useState(0)
  const [chunksProcessed, setChunksProcessed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const chunkStartTimeRef = useRef<number>(0)
  const silenceStartRef = useRef<number | null>(null)
  const isCapturingRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)
  const maxChunkDurationRef = useRef<number>(maxChunkDuration)
  const currentMimeTypeRef = useRef<string>('audio/webm;codecs=opus')

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

  // Finalizar chunk atual e enviar
  const finalizeChunk = useCallback((shouldStop = false) => {
    if (chunksRef.current.length === 0) {
      console.log('[Audio] Nenhum dado para enviar - resetando timer')
      chunkStartTimeRef.current = Date.now()
      setCurrentChunkDuration(0)
      return
    }

    // Verificar duração do chunk para validação
    const now = Date.now()
    const chunkDuration = now - chunkStartTimeRef.current
    
    // Usar o tipo MIME que foi usado na gravação
    const mimeType = currentMimeTypeRef.current
    const blob = new Blob(chunksRef.current, { type: mimeType })
    console.log('[Audio] ✅ Chunk finalizado:', blob.size, 'bytes, duração:', Math.floor(chunkDuration/1000) + 's, tipo:', mimeType)
    
    // Validação mais rigorosa: tamanho mínimo E duração mínima
    const minSize = 5000 // 5KB mínimo
    const minDuration = 1000 // 1 segundo mínimo
    
    if (blob.size > minSize && chunkDuration > minDuration && onChunkReady) {
      console.log('[Audio] 📤 Enviando chunk #' + (chunksProcessed + 1) + ' para transcrição...')
      setChunksProcessed(prev => prev + 1)
      onChunkReady(blob)
    } else {
      console.log('[Audio] ⚠️ Chunk inválido - tamanho:', blob.size, 'duração:', Math.floor(chunkDuration/1000) + 's - ignorando')
    }
    
    // Verificar se deve continuar gravando ou parar
    if (shouldStop || !infiniteLoop) {
      // MODO ÚNICO ou parada forçada: Parar gravação após chunk
      console.log('[Audio] 🛑 Parando gravação após chunk')
      // Limpar chunks para evitar reenvio
      chunksRef.current = []
      // Não chamar stopCapture aqui para evitar recursão
    } else {
      // MODO INFINITO: Resetar para próximo chunk (gravação continua)
      chunksRef.current = []
      chunkStartTimeRef.current = Date.now()
      setCurrentChunkDuration(0)
      console.log('[Audio] 🔄 Modo infinito: Próximo chunk iniciado - gravação continua...')
    }
  }, [onChunkReady, chunksProcessed, infiniteLoop])

  // Declaração antecipada da função stopCapture para uso no finalizeChunk
  const stopCapture = useCallback(() => {
    console.log('[Audio] Parando captura...')
    
    isCapturingRef.current = false
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

    // Parar MediaRecorder e aguardar finalização
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Aguardar o MediaRecorder finalizar antes de processar último chunk
      mediaRecorderRef.current.addEventListener('stop', () => {
        // Enviar último chunk apenas se houver dados suficientes e válidos
        if (chunksRef.current.length > 0) {
          const now = Date.now()
          const chunkDuration = now - chunkStartTimeRef.current
          
          // Só enviar se o chunk tem pelo menos 3 segundos E tamanho adequado (evita chunks corrompidos)
          if (chunkDuration >= 3000) {
            const mimeType = currentMimeTypeRef.current
            const blob = new Blob(chunksRef.current, { type: mimeType })
            console.log('[Audio] ✅ Último chunk válido:', blob.size, 'bytes, duração:', Math.floor(chunkDuration/1000) + 's')
            
            // Validação mais rigorosa para último chunk (mais propenso a corrupção)
            if (blob.size > 10000 && onChunkReady) { // 10KB mínimo para último chunk
              console.log('[Audio] 📤 Enviando último chunk para transcrição...')
              setChunksProcessed(prev => prev + 1)
              onChunkReady(blob)
            } else {
              console.log('[Audio] ⚠️ Último chunk muito pequeno (' + blob.size + ' bytes), ignorando para evitar erro de API')
            }
          } else {
            console.log('[Audio] ⚠️ Último chunk muito curto (' + Math.floor(chunkDuration/1000) + 's), ignorando para evitar corrupção')
          }
        }
      }, { once: true })
      
      mediaRecorderRef.current.stop()
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsCapturing(false)
    setIsPaused(false)
    console.log('[Audio] Captura parada')
  }, [onChunkReady])

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
      if (infiniteLoop) {
        console.log(`[Audio] ⏰ Tempo limite atingido (${Math.floor(maxDuration/1000)}s) - enviando chunk e continuando...`)
        finalizeChunk()
      } else {
        console.log(`[Audio] ⏰ Tempo limite atingido (${Math.floor(maxDuration/1000)}s) - enviando chunk e parando (modo único)`)
        finalizeChunk()
        // Parar gravação após finalizar chunk no modo único
        setTimeout(() => {
          if (isCapturingRef.current) {
            console.log('[Audio] 🛑 Parando gravação automática (modo único)')
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
      console.log(`[Audio] 📊 Gravando (${mode})... ${Math.floor(chunkDuration/1000)}s/${Math.floor(maxDuration/1000)}s (${remaining}s restantes)`)
    }
  }, [finalizeChunk, infiniteLoop, stopCapture])

  // Iniciar captura de áudio do sistema
  const startCapture = useCallback(async () => {
    try {
      setError(null)
      setChunksProcessed(0)
      
      console.log('[Audio] Iniciando captura de audio do sistema...')
      
      // @ts-ignore
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1, height: 1, frameRate: 1 },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const audioTracks = stream.getAudioTracks()
      console.log('[Audio] Audio tracks:', audioTracks.length)
      
      if (audioTracks.length === 0) {
        stream.getVideoTracks().forEach(track => track.stop())
        throw new Error('Nenhum audio disponivel. Compartilhe uma aba/janela com audio.')
      }

      stream.getVideoTracks().forEach(track => track.stop())

      const audioStream = new MediaStream(audioTracks)
      mediaStreamRef.current = audioStream

      // AudioContext para análise
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(audioStream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // MediaRecorder - tentar usar formato mais compatível com Whisper
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
          console.log('[Audio] Usando formato:', format)
          break
        }
      }
      
      // Armazenar o tipo MIME usado
      currentMimeTypeRef.current = mimeType
      
      const mediaRecorder = new MediaRecorder(audioStream, recorderOptions)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && isCapturingRef.current) {
          chunksRef.current.push(event.data)
        }
      }

      // Quando o track de áudio terminar (usuário parou compartilhamento)
      audioTracks[0].onended = () => {
        console.log('[Audio] Track de audio encerrado pelo usuario - mas gravação continua!')
        // NÃO parar a captura - deixar o usuário decidir quando parar
      }

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      chunkStartTimeRef.current = Date.now()

      // Iniciar gravação
      mediaRecorder.start(1000)
      console.log('[Audio] MediaRecorder iniciado')

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

      console.log('[Audio] Captura iniciada com sucesso!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao capturar audio'
      setError(errorMessage)
      console.error('[Audio] Erro:', err)
    }
  }, [checkAndSendChunk])


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
      console.log('[Audio] Captura pausada')
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
      console.log('[Audio] Captura retomada')
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
    error,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
    formatDuration,
  }
}
