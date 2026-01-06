import { useState, useEffect, useMemo } from 'react'
import {
  Settings as SettingsIcon,
  X,
  Key,
  Bot,
  Globe,
  FileText,
  Headphones,
  Volume2,
  BarChart3,
  Timer,
  Package,
  Keyboard,
  Save,
  Clock,
  Mic,
  Infinity,
  Square,
  Eye,
  EyeOff,
  Monitor,
  Palette,
  Circle,
  Sun,
  Moon,
  Database,
  AlertTriangle,
  Zap,
  RefreshCw
} from 'lucide-react'
import { MODEL_CONTEXT_INFO, type ModelContextInfo } from '../services/openai-service'

// Função para formatar número de tokens
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`
  }
  return tokens.toString()
}

interface AudioDevice {
  deviceId: string
  label: string
}

// Temas de cores predefinidos
const colorThemes = {
  cyan: {
    name: 'Ciano (Padrão)',
    primary: '#06b6d4',
    secondary: '#0891b2',
    accent: '#22d3ee',
    border: 'rgba(6, 182, 212, 0.3)',
  },
  purple: {
    name: 'Roxo',
    primary: '#8b5cf6',
    secondary: '#7c3aed',
    accent: '#a78bfa',
    border: 'rgba(139, 92, 246, 0.3)',
  },
  green: {
    name: 'Verde',
    primary: '#10b981',
    secondary: '#059669',
    accent: '#34d399',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  orange: {
    name: 'Laranja',
    primary: '#f97316',
    secondary: '#ea580c',
    accent: '#fb923c',
    border: 'rgba(249, 115, 22, 0.3)',
  },
  pink: {
    name: 'Rosa',
    primary: '#ec4899',
    secondary: '#db2777',
    accent: '#f472b6',
    border: 'rgba(236, 72, 153, 0.3)',
  },
  blue: {
    name: 'Azul',
    primary: '#3b82f6',
    secondary: '#2563eb',
    accent: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.3)',
  },
}

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  settings: {
    system_prompt: string
    model: string
    language: string
    api_key: string
    audio_device?: string
    microphone_device?: string
    enable_microphone?: string
    silence_threshold?: string
    silence_duration?: string
    max_chunk_duration?: string
    infinite_loop_recording?: string
    hide_from_capture?: string
    // Configurações de aparência
    overlay_opacity?: string
    color_theme?: string
    border_radius?: string
    blur_intensity?: string
    // Configurações de contexto
    context_size?: string
    auto_condense?: string
  } | null
  onSave: (key: string, value: string) => Promise<void>
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [language, setLanguage] = useState('pt')
  const [apiKey, setApiKey] = useState('')
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [microphoneDevices, setMicrophoneDevices] = useState<AudioDevice[]>([])
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('default')
  const [selectedMicrophoneDevice, setSelectedMicrophoneDevice] = useState('default')
  const [enableMicrophone, setEnableMicrophone] = useState(false)
  const [silenceThreshold, setSilenceThreshold] = useState('0.02')
  const [silenceDuration, setSilenceDuration] = useState('2500')
  const [maxChunkDuration, setMaxChunkDuration] = useState('30000')
  const [infiniteLoopRecording, setInfiniteLoopRecording] = useState(true)
  const [extendedChunkMode, setExtendedChunkMode] = useState(false)
  const [hideFromCapture, setHideFromCapture] = useState(true) // Padrão: oculto em capturas
  // Estados de aparência
  const [overlayOpacity, setOverlayOpacity] = useState('85') // 0-100
  const [colorTheme, setColorTheme] = useState('cyan')
  const [borderRadius, setBorderRadius] = useState('16') // px
  const [blurIntensity, setBlurIntensity] = useState('12') // px
  // Estados de contexto
  const [contextSize, setContextSize] = useState('') // Vazio = usar máximo do modelo
  const [autoCondense, setAutoCondense] = useState(true) // Auto-condensar quando exceder limite
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Carregar dispositivos de áudio e microfone
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        
        // Dispositivos de saída (áudio do sistema)
        const audioOutputs = devices
          .filter(device => device.kind === 'audiooutput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Saída ${device.deviceId.slice(0, 8)}...`
          }))
        
        // Dispositivos de entrada (microfones)
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microfone ${device.deviceId.slice(0, 8)}...`
          }))
        
        setAudioDevices([
          { deviceId: 'default', label: 'Padrão do Sistema' },
          ...audioOutputs
        ])
        
        setMicrophoneDevices([
          { deviceId: 'default', label: 'Microfone Padrão' },
          ...audioInputs
        ])
      } catch (error) {
        console.error('Erro ao carregar dispositivos de áudio:', error)
      }
    }
    
    if (isOpen) {
      loadAudioDevices()
    }
  }, [isOpen])

  useEffect(() => {
    if (settings) {
      setSystemPrompt(settings.system_prompt || '')
      setModel(settings.model || 'gpt-4o')
      setLanguage(settings.language || 'pt')
      setApiKey(settings.api_key || '')
      setSelectedAudioDevice(settings.audio_device || 'default')
      setSelectedMicrophoneDevice(settings.microphone_device || 'default')
      setEnableMicrophone(settings.enable_microphone === 'true')
      setSilenceThreshold(settings.silence_threshold || '0.02')
      setSilenceDuration(settings.silence_duration || '2500')
      setMaxChunkDuration(settings.max_chunk_duration || '30000')
      setInfiniteLoopRecording(settings.infinite_loop_recording === 'true' || settings.infinite_loop_recording === undefined)
      setExtendedChunkMode((settings as any).extended_chunk_mode === 'true')
      // Padrão é true (oculto) se não estiver configurado
      setHideFromCapture(settings.hide_from_capture === 'true' || settings.hide_from_capture === undefined)
      // Configurações de aparência
      setOverlayOpacity(settings.overlay_opacity || '85')
      setColorTheme(settings.color_theme || 'cyan')
      setBorderRadius(settings.border_radius || '16')
      setBlurIntensity(settings.blur_intensity || '12')
      // Configurações de contexto
      setContextSize(settings.context_size || '')
      setAutoCondense(settings.auto_condense === 'true' || settings.auto_condense === undefined)
    }
  }, [settings])

  // Obter informações do modelo selecionado
  const modelInfo = useMemo(() => {
    return MODEL_CONTEXT_INFO[model] || {
      contextWindow: 128000,
      maxOutput: 16384,
      name: model
    }
  }, [model])

  // Calcular tamanho de contexto efetivo
  const effectiveContextSize = useMemo(() => {
    if (contextSize && parseInt(contextSize) > 0) {
      return Math.min(parseInt(contextSize), modelInfo.contextWindow)
    }
    return modelInfo.contextWindow
  }, [contextSize, modelInfo])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      await onSave('system_prompt', systemPrompt)
      await onSave('model', model)
      await onSave('language', language)
      await onSave('audio_device', selectedAudioDevice)
      await onSave('microphone_device', selectedMicrophoneDevice)
      await onSave('enable_microphone', enableMicrophone.toString())
      await onSave('silence_threshold', silenceThreshold)
      await onSave('silence_duration', silenceDuration)
      await onSave('max_chunk_duration', maxChunkDuration)
      await onSave('infinite_loop_recording', infiniteLoopRecording.toString())
      await onSave('extended_chunk_mode', extendedChunkMode.toString())
      await onSave('hide_from_capture', hideFromCapture.toString())
      // Salvar configurações de aparência
      await onSave('overlay_opacity', overlayOpacity)
      await onSave('color_theme', colorTheme)
      await onSave('border_radius', borderRadius)
      await onSave('blur_intensity', blurIntensity)
      // Salvar configurações de contexto
      await onSave('context_size', contextSize)
      await onSave('auto_condense', autoCondense.toString())
      
      // Aplicar proteção de conteúdo imediatamente (com verificação de segurança)
      if (window.electronAPI?.setContentProtection) {
        try {
          window.electronAPI.setContentProtection(hideFromCapture)
        } catch (e) {
          console.warn('Não foi possível aplicar proteção de conteúdo:', e)
        }
      }
      
      if (apiKey) {
        await onSave('api_key', apiKey)
        localStorage.setItem('openai_api_key', apiKey)
      }
      
      setSaveMessage('Configurações salvas!')
      setTimeout(() => setSaveMessage(''), 2000)
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      setSaveMessage('Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  // Handler para toggle de visibilidade em capturas (aplica imediatamente)
  const handleHideFromCaptureToggle = () => {
    const newValue = !hideFromCapture
    setHideFromCapture(newValue)
    // Aplicar imediatamente para feedback visual instantâneo (com verificação de segurança)
    if (window.electronAPI?.setContentProtection) {
      try {
        window.electronAPI.setContentProtection(newValue)
      } catch (e) {
        console.warn('Não foi possível aplicar proteção de conteúdo:', e)
      }
    }
  }

  if (!isOpen) return null

  // Obter tema atual
  const currentTheme = colorThemes[colorTheme as keyof typeof colorThemes] || colorThemes.cyan
  const opacity = parseInt(overlayOpacity) / 100
  const radius = parseInt(borderRadius)
  const blur = parseInt(blurIntensity)

  // Estilos base compactos - usando slate (mais escuro/preto)
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: `rgba(15, 23, 42, ${Math.max(0.8, opacity * 0.95)})`, // slate-900
    border: `1px solid ${currentTheme.border}`,
    borderRadius: `${Math.min(radius, 6)}px`,
    padding: '8px 10px',
    fontSize: '12px',
    color: '#e5e7eb',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 500,
    color: '#d1d5db',
    marginBottom: '4px',
  }

  const fieldGroupStyle: React.CSSProperties = {
    marginBottom: '12px',
  }

  const helpTextStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#6b7280',
    marginTop: '3px',
  }

  return (
    <div style={{
      width: '320px',
      borderLeft: `1px solid ${currentTheme.border}`,
      background: `rgba(15, 23, 42, ${opacity * 0.7})`, // slate-900
      backdropFilter: `blur(${blur}px)`,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderTopRightRadius: `${radius}px`,
      borderBottomRightRadius: `${radius}px`,
    }}>
      {/* Header - Mesmo padrão do Overlay */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${currentTheme.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '56px',
        minHeight: '56px',
        background: `linear-gradient(to right, rgba(15, 23, 42, ${opacity * 0.9}), rgba(2, 6, 23, ${opacity * 0.9}))`, // slate-900 to slate-950 com opacidade
        backdropFilter: `blur(${blur}px)`,
        borderTopRightRadius: `${radius}px`,
      }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: currentTheme.accent,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <SettingsIcon size={16} style={{ color: currentTheme.accent }} /> Configurações
        </h2>
        <button
          onClick={onClose}
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(234, 88, 12, 0.2)',
            color: '#fb923c',
            borderRadius: `${Math.min(radius, 8)}px`,
            border: '1px solid rgba(234, 88, 12, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        {/* API Key */}
        <div style={fieldGroupStyle}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Key size={12} /> API Key da OpenAI
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={inputStyle}
          />
          <p style={helpTextStyle}>
            Sua chave é armazenada localmente.
          </p>
        </div>

        {/* Model */}
        <div style={fieldGroupStyle}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Bot size={12} /> Modelo
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={inputStyle}
          >
            <option value="gpt-4o">GPT-4o (Recomendado)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Mais rápido)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Econômico)</option>
          </select>
          {/* Info do modelo selecionado */}
          <div style={{
            marginTop: '8px',
            padding: '8px',
            background: 'rgba(6, 182, 212, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(6, 182, 212, 0.2)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#9ca3af',
            }}>
              <span>Contexto: <strong style={{ color: currentTheme.accent }}>{formatTokens(modelInfo.contextWindow)}</strong></span>
              <span>Saída máx: <strong style={{ color: currentTheme.accent }}>{formatTokens(modelInfo.maxOutput)}</strong></span>
            </div>
          </div>
        </div>

        {/* Context Settings Section */}
        <div style={{
          marginBottom: '12px',
          padding: '12px',
          background: `rgba(15, 23, 42, ${opacity * 0.7})`,
          borderRadius: `${Math.min(radius, 12)}px`,
          border: `1px solid ${currentTheme.border}`,
        }}>
          <h3 style={{
            fontSize: '12px',
            fontWeight: 500,
            color: currentTheme.accent,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Database size={12} />
            Contexto e Memória
          </h3>

          {/* Tamanho de Contexto */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} /> Tamanho de Contexto
            </label>
            <select
              value={contextSize}
              onChange={(e) => setContextSize(e.target.value)}
              style={inputStyle}
            >
              <option value="">Máximo do modelo ({formatTokens(modelInfo.contextWindow)})</option>
              <option value="4096">4K tokens</option>
              <option value="8192">8K tokens</option>
              <option value="16384">16K tokens</option>
              <option value="32768">32K tokens</option>
              <option value="65536">64K tokens</option>
              {modelInfo.contextWindow >= 128000 && (
                <option value="128000">128K tokens</option>
              )}
              {modelInfo.contextWindow >= 200000 && (
                <option value="200000">200K tokens</option>
              )}
            </select>
            <p style={helpTextStyle}>
              Contexto efetivo: <strong style={{ color: currentTheme.accent }}>{formatTokens(effectiveContextSize)}</strong> tokens
            </p>
          </div>

          {/* Auto-condensamento */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={12} /> Auto-condensamento
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}>
              <button
                onClick={() => setAutoCondense(!autoCondense)}
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  background: autoCondense
                    ? 'linear-gradient(to right, #059669, #10b981)'
                    : 'rgba(55, 65, 81, 0.8)',
                  transition: 'all 0.3s ease',
                  boxShadow: autoCondense
                    ? '0 0 8px rgba(16, 185, 129, 0.3)'
                    : 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: autoCondense ? '22px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'white',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RefreshCw size={8} style={{ color: autoCondense ? '#059669' : '#6b7280' }} />
                </div>
              </button>
              <span style={{
                fontSize: '11px',
                color: autoCondense ? '#10b981' : '#9ca3af',
                fontWeight: 500,
              }}>
                {autoCondense ? 'Ativado' : 'Desativado'}
              </span>
            </div>
            <p style={helpTextStyle}>
              {autoCondense
                ? 'Quando a conversa exceder o limite, mensagens antigas serão resumidas automaticamente.'
                : 'Mensagens antigas serão descartadas quando exceder o limite.'
              }
            </p>
          </div>

          {/* Aviso de contexto grande */}
          {effectiveContextSize > 32768 && (
            <div style={{
              marginTop: '12px',
              padding: '8px',
              background: 'rgba(234, 179, 8, 0.1)',
              borderRadius: '6px',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}>
              <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '10px', color: '#fbbf24' }}>
                Contextos grandes ({formatTokens(effectiveContextSize)}+) podem aumentar significativamente o custo e tempo de resposta.
              </div>
            </div>
          )}
        </div>

        {/* Language */}
        <div style={fieldGroupStyle}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Globe size={12} /> Idioma de Transcrição
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={inputStyle}
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </div>

        {/* System Prompt */}
        <div style={fieldGroupStyle}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={12} /> System Prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Defina a personalidade e comportamento do assistente..."
            rows={4}
            style={{
              ...inputStyle,
              resize: 'none',
              minHeight: '80px',
            }}
          />
          <p style={helpTextStyle}>
            Define o comportamento da IA.
          </p>
        </div>

        {/* Audio Settings Section */}
        <div style={{
          marginBottom: '12px',
          padding: '12px',
          background: `rgba(15, 23, 42, ${opacity * 0.7})`, // slate-900
          borderRadius: `${Math.min(radius, 12)}px`,
          border: `1px solid ${currentTheme.border}`,
        }}>
          <h3 style={{
            fontSize: '12px',
            fontWeight: 500,
            color: currentTheme.accent,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Headphones size={12} />
            Configurações de Áudio
          </h3>
          
          {/* Audio Device */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Volume2 size={12} /> Dispositivo de Áudio
            </label>
            <select
              value={selectedAudioDevice}
              onChange={(e) => setSelectedAudioDevice(e.target.value)}
              style={inputStyle}
            >
              {audioDevices.map((device, index) => (
                <option key={`audio-${device.deviceId}-${index}`} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>

          {/* Enable Microphone */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Mic size={12} /> Captura de Microfone
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}>
              <button
                onClick={() => setEnableMicrophone(!enableMicrophone)}
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  background: enableMicrophone
                    ? 'linear-gradient(to right, #dc2626, #ef4444)'
                    : 'rgba(55, 65, 81, 0.8)',
                  transition: 'all 0.3s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: enableMicrophone ? '22px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'white',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {enableMicrophone ? (
                    <Mic size={8} style={{ color: '#dc2626' }} />
                  ) : (
                    <X size={8} style={{ color: '#6b7280' }} />
                  )}
                </div>
              </button>
              <span style={{
                fontSize: '11px',
                color: enableMicrophone ? '#ef4444' : '#9ca3af',
                fontWeight: 500,
              }}>
                {enableMicrophone ? 'Ativado' : 'Desativado'}
              </span>
            </div>
          </div>

          {/* Microphone Device - só aparece se microfone estiver ativado */}
          {enableMicrophone && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Mic size={12} /> Dispositivo de Microfone
              </label>
              <select
                value={selectedMicrophoneDevice}
                onChange={(e) => setSelectedMicrophoneDevice(e.target.value)}
                style={inputStyle}
              >
                {microphoneDevices.map((device, index) => (
                  <option key={`mic-${device.deviceId}-${index}`} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Silence Threshold */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BarChart3 size={12} /> Threshold: {silenceThreshold}
            </label>
            <input
              type="range"
              min="0.005"
              max="0.1"
              step="0.005"
              value={silenceThreshold}
              onChange={(e) => setSilenceThreshold(e.target.value)}
              style={{
                width: '100%',
                height: '6px',
                background: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                accentColor: currentTheme.primary,
              }}
            />
          </div>

          {/* Silence Duration */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Timer size={12} /> Silêncio: {(parseInt(silenceDuration) / 1000).toFixed(1)}s
            </label>
            <input
              type="range"
              min="1000"
              max="5000"
              step="500"
              value={silenceDuration}
              onChange={(e) => setSilenceDuration(e.target.value)}
              style={{
                width: '100%',
                height: '6px',
                background: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                accentColor: currentTheme.primary,
              }}
            />
          </div>

          {/* Switch para Modo Estendido */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Modo Estendido (até 10min)
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}>
              <button
                onClick={() => setExtendedChunkMode(!extendedChunkMode)}
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  background: extendedChunkMode
                    ? 'linear-gradient(to right, #059669, #10b981)'
                    : 'rgba(55, 65, 81, 0.8)',
                  transition: 'all 0.3s ease',
                  boxShadow: extendedChunkMode
                    ? '0 0 8px rgba(16, 185, 129, 0.3)'
                    : 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: extendedChunkMode ? '22px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'white',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Clock size={8} style={{ color: extendedChunkMode ? '#059669' : '#6b7280' }} />
                </div>
              </button>
              <span style={{
                fontSize: '11px',
                color: extendedChunkMode ? '#10b981' : '#9ca3af',
                fontWeight: 500,
              }}>
                {extendedChunkMode ? 'Ativado' : 'Desativado'}
              </span>
            </div>
            <p style={helpTextStyle}>
              {extendedChunkMode
                ? 'Permite chunks de até 10 minutos para aulas longas'
                : 'Limite padrão de 5 minutos por chunk'
              }
            </p>
          </div>

          {/* Max Chunk Duration */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Package size={12} /> Chunk Máximo
            </label>
            
            {/* Input manual + Display formatado */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}>
              <input
                type="number"
                min="5"
                max={extendedChunkMode ? 600 : 300}
                step="5"
                value={Math.floor(parseInt(maxChunkDuration) / 1000)}
                onChange={(e) => {
                  const seconds = Math.max(5, Math.min(extendedChunkMode ? 600 : 300, parseInt(e.target.value) || 5))
                  setMaxChunkDuration(String(seconds * 1000))
                }}
                style={{
                  ...inputStyle,
                  width: '70px',
                  textAlign: 'center',
                  padding: '6px 8px',
                }}
              />
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>segundos</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: '12px',
                fontWeight: 500,
                color: currentTheme.accent,
                padding: '4px 8px',
                background: `rgba(${parseInt(currentTheme.primary.slice(1, 3), 16)}, ${parseInt(currentTheme.primary.slice(3, 5), 16)}, ${parseInt(currentTheme.primary.slice(5, 7), 16)}, 0.2)`,
                borderRadius: '4px',
              }}>
                {Math.floor(parseInt(maxChunkDuration) / 60000)}:{String(Math.floor((parseInt(maxChunkDuration) % 60000) / 1000)).padStart(2, '0')}
              </span>
            </div>
            
            {/* Slider com step de 5 segundos */}
            <input
              type="range"
              min="5000"
              max={extendedChunkMode ? "600000" : "300000"}
              step="5000"
              value={maxChunkDuration}
              onChange={(e) => setMaxChunkDuration(e.target.value)}
              style={{
                width: '100%',
                height: '6px',
                background: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                accentColor: extendedChunkMode ? '#10b981' : currentTheme.primary,
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#6b7280',
              marginTop: '4px',
            }}>
              <span>5s</span>
              <span>30s</span>
              <span>1min</span>
              <span>2min</span>
              <span>{extendedChunkMode ? '10min' : '5min'}</span>
            </div>
          </div>

          {/* Loop Infinito */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Infinity size={12} /> Loop Infinito
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}>
              <button
                onClick={() => setInfiniteLoopRecording(!infiniteLoopRecording)}
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  background: infiniteLoopRecording
                    ? 'linear-gradient(to right, #059669, #10b981)'
                    : 'rgba(55, 65, 81, 0.8)',
                  transition: 'all 0.3s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: infiniteLoopRecording ? '22px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'white',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {infiniteLoopRecording ? (
                    <Infinity size={8} style={{ color: '#059669' }} />
                  ) : (
                    <Square size={6} style={{ color: '#6b7280' }} />
                  )}
                </div>
              </button>
              <span style={{
                fontSize: '11px',
                color: infiniteLoopRecording ? '#10b981' : '#9ca3af',
                fontWeight: 500,
              }}>
                {infiniteLoopRecording ? 'Ativado' : 'Desativado'}
              </span>
            </div>
          </div>
        </div>

        {/* Visibilidade em Capturas Section */}
        <div style={{
          marginBottom: '12px',
          padding: '12px',
          background: `rgba(15, 23, 42, ${opacity * 0.7})`, // slate-900
          borderRadius: `${Math.min(radius, 12)}px`,
          border: `1px solid ${hideFromCapture ? currentTheme.border : 'rgba(234, 179, 8, 0.4)'}`,
        }}>
          <h3 style={{
            fontSize: '12px',
            fontWeight: 500,
            color: hideFromCapture ? '#67e8f9' : '#fbbf24',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Monitor size={12} />
            Visibilidade em Capturas
          </h3>
          
          {/* Toggle Ocultar em Capturas */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {hideFromCapture ? <EyeOff size={12} /> : <Eye size={12} />} Ocultar em Screenshots/Gravações
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}>
              <button
                onClick={handleHideFromCaptureToggle}
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  background: hideFromCapture
                    ? 'linear-gradient(to right, #0891b2, #06b6d4)'
                    : 'linear-gradient(to right, #d97706, #f59e0b)',
                  transition: 'all 0.3s ease',
                  boxShadow: hideFromCapture
                    ? '0 0 8px rgba(6, 182, 212, 0.3)'
                    : '0 0 8px rgba(245, 158, 11, 0.3)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: hideFromCapture ? '22px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'white',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {hideFromCapture ? (
                    <EyeOff size={8} style={{ color: '#0891b2' }} />
                  ) : (
                    <Eye size={8} style={{ color: '#d97706' }} />
                  )}
                </div>
              </button>
              <span style={{
                fontSize: '11px',
                color: hideFromCapture ? '#22d3ee' : '#fbbf24',
                fontWeight: 500,
              }}>
                {hideFromCapture ? 'Oculto (Seguro)' : 'Visível (Reuniões)'}
              </span>
            </div>
            <p style={{
              ...helpTextStyle,
              color: hideFromCapture ? '#6b7280' : '#fbbf24',
            }}>
              {hideFromCapture
                ? 'O overlay NÃO aparece em screenshots, gravações ou compartilhamento de tela.'
                : '⚠️ O overlay APARECERÁ em screenshots, gravações e compartilhamento de tela!'
              }
            </p>
          </div>
        </div>

        {/* Aparência Section */}
        <div style={{
          marginBottom: '12px',
          padding: '12px',
          background: `rgba(15, 23, 42, ${opacity * 0.7})`, // slate-900
          borderRadius: `${Math.min(radius, 12)}px`,
          border: `1px solid ${currentTheme.border}`,
        }}>
          <h3 style={{
            fontSize: '12px',
            fontWeight: 500,
            color: currentTheme.accent,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Palette size={12} />
            Aparência
          </h3>
          
          {/* Opacidade do Fundo */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sun size={12} /> Opacidade: {overlayOpacity}%
            </label>
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(e.target.value)}
              style={{
                width: '100%',
                height: '6px',
                background: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                accentColor: colorThemes[colorTheme as keyof typeof colorThemes]?.primary || '#06b6d4',
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#6b7280',
              marginTop: '4px',
            }}>
              <span>Transparente</span>
              <span>Opaco</span>
            </div>
            <p style={helpTextStyle}>
              Menor opacidade = mais transparente, permite ver o fundo melhor.
            </p>
          </div>

          {/* Intensidade do Blur */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Moon size={12} /> Blur: {blurIntensity}px
            </label>
            <input
              type="range"
              min="0"
              max="24"
              step="2"
              value={blurIntensity}
              onChange={(e) => setBlurIntensity(e.target.value)}
              style={{
                width: '100%',
                height: '6px',
                background: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                accentColor: colorThemes[colorTheme as keyof typeof colorThemes]?.primary || '#06b6d4',
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#6b7280',
              marginTop: '4px',
            }}>
              <span>Sem blur</span>
              <span>Máximo</span>
            </div>
          </div>

          {/* Arredondamento das Bordas */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Circle size={12} /> Arredondamento: {borderRadius}px
            </label>
            <input
              type="range"
              min="0"
              max="32"
              step="4"
              value={borderRadius}
              onChange={(e) => setBorderRadius(e.target.value)}
              style={{
                width: '100%',
                height: '6px',
                background: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                accentColor: colorThemes[colorTheme as keyof typeof colorThemes]?.primary || '#06b6d4',
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#6b7280',
              marginTop: '4px',
            }}>
              <span>Quadrado</span>
              <span>Arredondado</span>
            </div>
          </div>

          {/* Tema de Cores */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
              <Palette size={12} /> Tema de Cores
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}>
              {Object.entries(colorThemes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => setColorTheme(key)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: colorTheme === key
                      ? `2px solid ${theme.primary}`
                      : '2px solid transparent',
                    background: colorTheme === key
                      ? `rgba(${parseInt(theme.primary.slice(1, 3), 16)}, ${parseInt(theme.primary.slice(3, 5), 16)}, ${parseInt(theme.primary.slice(5, 7), 16)}, 0.2)`
                      : 'rgba(55, 65, 81, 0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                    boxShadow: colorTheme === key ? `0 0 8px ${theme.primary}` : 'none',
                  }} />
                  <span style={{
                    fontSize: '10px',
                    color: colorTheme === key ? theme.accent : '#9ca3af',
                    fontWeight: colorTheme === key ? 600 : 400,
                  }}>
                    {theme.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: `${borderRadius}px`,
            background: `rgba(2, 6, 23, ${parseInt(overlayOpacity) / 100})`, // slate-950
            backdropFilter: `blur(${blurIntensity}px)`,
            border: `1px solid ${colorThemes[colorTheme as keyof typeof colorThemes]?.border || 'rgba(6, 182, 212, 0.3)'}`,
          }}>
            <div style={{
              fontSize: '11px',
              color: colorThemes[colorTheme as keyof typeof colorThemes]?.accent || '#67e8f9',
              marginBottom: '4px',
              fontWeight: 500,
            }}>
              Preview
            </div>
            <div style={{
              fontSize: '10px',
              color: '#9ca3af',
            }}>
              Assim ficará o overlay com as configurações atuais.
            </div>
          </div>
        </div>

        {/* Hotkeys Info */}
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: `rgba(15, 23, 42, ${opacity * 0.7})`, // slate-900
          borderRadius: `${Math.min(radius, 12)}px`,
          border: `1px solid ${currentTheme.border}`,
        }}>
          <h3 style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#d1d5db',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Keyboard size={12} />
            Atalhos de Teclado
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { label: 'Overlay', key: 'Ctrl+Alt+A' },
              { label: 'Screenshot', key: 'Ctrl+Alt+S' },
              { label: 'Gravar Áudio', key: 'Ctrl+Alt+R' },
              { label: 'Traduzir', key: 'Ctrl+Alt+T' },
            ].map(({ label, key }) => (
              <div key={key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                color: '#9ca3af',
              }}>
                <span>{label}</span>
                <kbd style={{
                  padding: '2px 6px',
                  background: '#374151',
                  borderRadius: '4px',
                  color: currentTheme.accent,
                  fontSize: '10px',
                  fontFamily: 'monospace',
                }}>{key}</kbd>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer com botões */}
      <div style={{
        padding: '16px',
        borderTop: `1px solid ${currentTheme.border}`,
        background: `rgba(2, 6, 23, ${opacity * 0.9})`, // slate-950
        backdropFilter: `blur(${blur}px)`,
        borderBottomRightRadius: `${radius}px`,
      }}>
        {saveMessage && (
          <div style={{
            fontSize: '12px',
            color: saveMessage.includes('Erro') ? '#f87171' : '#4ade80',
            marginBottom: '8px',
            textAlign: 'center',
          }}>
            {saveMessage}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'rgba(30, 41, 59, 0.6)', // slate-800
              color: '#d1d5db',
              borderRadius: `${Math.min(radius, 8)}px`,
              border: `1px solid ${currentTheme.border}`,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: `linear-gradient(to right, ${currentTheme.secondary}, ${currentTheme.primary})`,
              color: 'white',
              borderRadius: `${Math.min(radius, 8)}px`,
              border: 'none',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            {isSaving ? (
              <>
                <Clock size={12} /> Salvando...
              </>
            ) : (
              <>
                <Save size={12} /> Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
