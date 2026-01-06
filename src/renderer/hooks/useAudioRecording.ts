import { useState, useCallback, useRef } from 'react'

export interface AudioRecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
}

export const useAudioRecording = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setAudioBlob(null)
      chunksRef.current = []
      setDuration(0)

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      })
      
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        
        // Parar todas as tracks do stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start(100) // Coleta dados a cada 100ms
      setIsRecording(true)
      setIsPaused(false)

      // Timer para duração
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao acessar microfone'
      setError(errorMessage)
      console.error('Erro ao iniciar gravação:', err)
    }
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording, isPaused])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
    }
  }, [isRecording, isPaused])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    setIsRecording(false)
    setIsPaused(false)
    setDuration(0)
    setAudioBlob(null)
    chunksRef.current = []
  }, [])

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Converter blob para base64 para enviar para API
  const getAudioBase64 = useCallback(async (): Promise<string | null> => {
    if (!audioBlob) return null
    
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        // Remove o prefixo data:audio/webm;base64,
        const base64Data = base64.split(',')[1]
        resolve(base64Data)
      }
      reader.readAsDataURL(audioBlob)
    })
  }, [audioBlob])

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
    getAudioBase64,
  }
}
