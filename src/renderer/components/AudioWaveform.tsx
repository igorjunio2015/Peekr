import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { AudioWave, useMediaAudio, type AudioWaveController } from '@audiowave/react'
import { Pause, Play, Volume2, AlertCircle } from 'lucide-react'

interface AudioWaveformProps {
  audioUrl: string
  accentColor?: string
  backgroundColor?: string
  waveColor?: string
  progressColor?: string
  height?: number
  barWidth?: number
  barGap?: number
}

// Função para converter data URL para Blob URL
const dataUrlToBlobUrl = (dataUrl: string): string | null => {
  try {
    const parts = dataUrl.split(',')
    if (parts.length !== 2) return null
    
    const mimeMatch = parts[0].match(/:(.*?);/)
    if (!mimeMatch) return null
    
    const mime = mimeMatch[1]
    const bstr = atob(parts[1])
    const n = bstr.length
    const u8arr = new Uint8Array(n)
    
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i)
    }
    
    const blob = new Blob([u8arr], { type: mime })
    return URL.createObjectURL(blob)
  } catch (e) {
    console.error('[AudioWaveform] Error converting data URL to blob:', e)
    return null
  }
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioUrl,
  accentColor = '#06b6d4',
  backgroundColor = 'rgba(30, 41, 59, 0.8)',
  waveColor = '#64748b',
  progressColor = '#22d3ee',
  height = 48,
  barWidth = 3,
  barGap = 2,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioWaveRef = useRef<AudioWaveController>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  // Converter data URL para blob URL se necessário
  useEffect(() => {
    if (audioUrl.startsWith('data:')) {
      const url = dataUrlToBlobUrl(audioUrl)
      setBlobUrl(url)
      return () => {
        if (url) URL.revokeObjectURL(url)
      }
    } else {
      setBlobUrl(audioUrl)
    }
  }, [audioUrl])

  // Handler de erro memoizado
  const handleAudioError = useCallback((err: Error) => {
    console.error('[AudioWaveform] Audio error:', err)
    setError('Erro ao processar áudio')
  }, [])

  // Opções memoizadas para useMediaAudio
  const audioSourceOptions = useMemo(() => ({
    source: audioRef.current,
    onError: handleAudioError,
  }), [audioRef.current, handleAudioError])

  // Hook de visualização de áudio
  const { source } = useMediaAudio(audioSourceOptions)

  // Configurar eventos do elemento de áudio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      console.log('[AudioWaveform] Loaded metadata - Duration:', audio.duration)
      setDuration(audio.duration)
      setIsLoading(false)
      setIsReady(true)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }

    const handleError = () => {
      console.error('[AudioWaveform] Audio element error')
      setError('Erro ao carregar áudio')
      setIsLoading(false)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
      setIsReady(true)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
    }
  }, [blobUrl])

  // Handler de play/pause
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !isReady) return

    try {
      if (isPlaying) {
        audio.pause()
      } else {
        audio.play()
      }
    } catch (err) {
      console.error('[AudioWaveform] PlayPause error:', err)
    }
  }, [isReady, isPlaying])

  // Formatar tempo
  const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time) || time < 0) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calcular progresso para barra visual
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: backgroundColor,
        borderRadius: '12px',
        border: `1px solid ${accentColor}40`,
      }}
    >
      {/* Elemento de áudio oculto */}
      <audio
        ref={audioRef}
        src={blobUrl || undefined}
        preload="metadata"
        style={{ display: 'none' }}
      />

      {/* Botão Play/Pause */}
      <button
        onClick={handlePlayPause}
        disabled={isLoading || !!error || !isReady}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: `${accentColor}30`,
          border: `1px solid ${accentColor}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isLoading || error || !isReady ? 'not-allowed' : 'pointer',
          color: accentColor,
          flexShrink: 0,
          transition: 'all 0.2s',
          opacity: isLoading || error || !isReady ? 0.5 : 1,
        }}
      >
        {isLoading ? (
          <Volume2 size={16} style={{ opacity: 0.5, animation: 'pulse 1s infinite' }} />
        ) : error ? (
          <AlertCircle size={16} style={{ color: '#f87171' }} />
        ) : isPlaying ? (
          <Pause size={16} />
        ) : (
          <Play size={16} style={{ marginLeft: '2px' }} />
        )}
      </button>

      {/* Área de visualização */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        {/* Container do AudioWave com barra de progresso sobreposta */}
        <div
          style={{
            width: '100%',
            height: `${height}px`,
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: isReady ? 'pointer' : 'default',
            background: 'rgba(15, 23, 42, 0.6)',
            position: 'relative',
          }}
          onClick={(e) => {
            if (!isReady || !audioRef.current) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const percentage = x / rect.width
            audioRef.current.currentTime = percentage * duration
          }}
        >
          {/* Visualização de áudio */}
          {source && isPlaying ? (
            <AudioWave
              ref={audioWaveRef}
              source={source}
              height={height}
              width="100%"
              barColor={progressColor}
              secondaryBarColor={waveColor}
              barWidth={barWidth}
              gap={barGap}
              backgroundColor="transparent"
              amplitudeMode="rms"
              gain={2.0}
              rounded={2}
            />
          ) : (
            /* Barra de progresso estática quando não está tocando */
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Fundo da barra */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '8px',
                  right: '8px',
                  height: '4px',
                  background: waveColor,
                  borderRadius: '2px',
                  transform: 'translateY(-50%)',
                }}
              />
              {/* Progresso */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '8px',
                  width: `calc((100% - 16px) * ${progress / 100})`,
                  height: '4px',
                  background: progressColor,
                  borderRadius: '2px',
                  transform: 'translateY(-50%)',
                  transition: 'width 0.1s linear',
                }}
              />
              {/* Indicador de posição */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `calc(8px + (100% - 16px) * ${progress / 100})`,
                  width: '8px',
                  height: '8px',
                  background: accentColor,
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: `0 0 4px ${accentColor}`,
                }}
              />
            </div>
          )}
        </div>

        {/* Tempo atual / Tempo total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: accentColor,
          opacity: 0.9,
          fontFamily: 'monospace',
        }}>
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>

        {/* Mensagem de erro */}
        {error && (
          <div style={{
            fontSize: '10px',
            color: '#f87171',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default AudioWaveform
