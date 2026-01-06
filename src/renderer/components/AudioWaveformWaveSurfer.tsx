import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useWavesurfer } from '@wavesurfer/react'
import { Pause, Play, Volume2, AlertCircle } from 'lucide-react'

interface AudioWaveformWaveSurferProps {
  audioUrl: string
  accentColor?: string
  backgroundColor?: string
  waveColor?: string
  progressColor?: string
  height?: number
  barWidth?: number
  barGap?: number
  barRadius?: number
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
  } catch {
    return null
  }
}

export const AudioWaveformWaveSurfer: React.FC<AudioWaveformWaveSurferProps> = ({
  audioUrl,
  accentColor = '#06b6d4',
  backgroundColor = 'rgba(30, 41, 59, 0.8)',
  waveColor = '#64748b',
  progressColor = '#22d3ee',
  height = 24,
  barWidth = 2,
  barGap = 1,
  barRadius = 2,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
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

  // Altura interna maior para o WaveSurfer (ondas simétricas)
  // Usamos o dobro da altura desejada para ter espaço para as ondas
  const internalHeight = height * 2

  // Usar o hook useWavesurfer do @wavesurfer/react
  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: internalHeight,
    waveColor: waveColor,
    progressColor: progressColor,
    cursorColor: accentColor,
    cursorWidth: 1,
    barWidth: barWidth,
    barGap: barGap,
    barRadius: barRadius,
    normalize: true,
    url: blobUrl || undefined,
  })

  // Obter duração quando o wavesurfer estiver pronto
  const [duration, setDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Função para alinhar os elementos internos do WaveSurfer
  // O WaveSurfer usa Shadow DOM e o div.progress tem position:absolute com top:0
  // enquanto o div.canvases está no fluxo normal. Isso causa desalinhamento
  // quando usamos transform:translateY(-50%) no container externo.
  // Esta função ajusta o top do progress para compensar a diferença.
  const alignWavesurferElements = useCallback(() => {
    if (!wavesurfer || !containerRef.current) return
    
    try {
      const wavesurferElement = containerRef.current.querySelector('div')
      if (!wavesurferElement) return
      
      const shadowRoot = wavesurferElement.shadowRoot
      if (shadowRoot) {
        const progressDiv = shadowRoot.querySelector('.progress') as HTMLElement
        const canvasesDiv = shadowRoot.querySelector('.canvases') as HTMLElement
        
        if (progressDiv && canvasesDiv) {
          const progressStyle = window.getComputedStyle(progressDiv)
          
          if (progressStyle.position === 'absolute') {
            const canvasesRect = canvasesDiv.getBoundingClientRect()
            const progressRect = progressDiv.getBoundingClientRect()
            
            // Se as posições são diferentes, ajustar o progress
            if (Math.abs(canvasesRect.top - progressRect.top) > 1) {
              const diff = canvasesRect.top - progressRect.top
              const currentTop = parseFloat(progressStyle.top) || 0
              progressDiv.style.top = `${currentTop + diff}px`
            }
          }
        }
      }
    } catch {
      // Silenciar erros de alinhamento
    }
  }, [wavesurfer])

  // MutationObserver para monitorar mudanças no DOM do WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new MutationObserver(() => {
      alignWavesurferElements()
    })

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    })

    return () => observer.disconnect()
  }, [alignWavesurferElements])

  useEffect(() => {
    if (!wavesurfer) return

    const handleReady = () => {
      setDuration(wavesurfer.getDuration())
      setIsLoading(false)
      setIsReady(true)
      setError(null)
      
      // Alinhar elementos após o WaveSurfer estar pronto
      setTimeout(alignWavesurferElements, 50)
    }

    const handleError = () => {
      setError('Erro ao carregar áudio')
      setIsLoading(false)
    }

    const handleFinish = () => {
      wavesurfer.setTime(0)
    }

    wavesurfer.on('ready', handleReady)
    wavesurfer.on('error', handleError)
    wavesurfer.on('finish', handleFinish)

    return () => {
      wavesurfer.un('ready', handleReady)
      wavesurfer.un('error', handleError)
      wavesurfer.un('finish', handleFinish)
    }
  }, [wavesurfer, alignWavesurferElements])

  // Handler de play/pause
  const handlePlayPause = useCallback(() => {
    if (!wavesurfer || !isReady) return
    wavesurfer.playPause()
  }, [wavesurfer, isReady])

  // Formatar tempo
  const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time) || time < 0) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        background: backgroundColor,
        borderRadius: '6px',
        border: `1px solid ${accentColor}25`,
      }}
    >
      {/* Botão Play/Pause */}
      <button
        onClick={handlePlayPause}
        disabled={isLoading || !!error || !isReady}
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: `${accentColor}20`,
          border: `1px solid ${accentColor}35`,
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
          <Volume2 size={10} style={{ opacity: 0.5, animation: 'pulse 1s infinite' }} />
        ) : error ? (
          <AlertCircle size={10} style={{ color: '#f87171' }} />
        ) : isPlaying ? (
          <Pause size={10} />
        ) : (
          <Play size={10} style={{ marginLeft: '1px' }} />
        )}
      </button>

      {/* Container do WaveSurfer - mostra apenas a parte central das ondas */}
      <div
        style={{
          flex: 1,
          minWidth: '80px',
          height: `${height}px`,
          overflow: 'hidden',
          borderRadius: '3px',
          cursor: isReady ? 'pointer' : 'default',
          position: 'relative',
        }}
      >
        <div
          ref={containerRef}
          style={{
            width: '100%',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </div>

      {/* Tempo */}
      <div style={{
        fontSize: '9px',
        color: accentColor,
        opacity: 0.75,
        fontFamily: 'monospace',
        flexShrink: 0,
        minWidth: '55px',
        textAlign: 'right',
      }}>
        {formatTime(currentTime)}/{duration > 0 ? formatTime(duration) : '--:--'}
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div style={{
          fontSize: '8px',
          color: '#f87171',
        }}>
          !
        </div>
      )}
    </div>
  )
}

export default AudioWaveformWaveSurfer
