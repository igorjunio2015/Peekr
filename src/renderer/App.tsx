import { useState, useEffect } from 'react'
import { Overlay } from './components/Overlay'
import { Key, Keyboard, Eye, EyeOff } from 'lucide-react'

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [showConfig, setShowConfig] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const loadApiKey = async () => {
      setIsLoading(true)
      
      // Tentar carregar do banco de dados primeiro
      if (window.electronAPI?.dbGetSetting) {
        try {
          const dbApiKey = await window.electronAPI.dbGetSetting('api_key')
          if (dbApiKey) {
            setApiKey(dbApiKey)
            localStorage.setItem('openai_api_key', dbApiKey)
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('Erro ao carregar API key do banco:', error)
        }
      }
      
      // Fallback para localStorage
      const savedApiKey = localStorage.getItem('openai_api_key')
      if (savedApiKey) {
        setApiKey(savedApiKey)
      } else {
        setShowConfig(true)
      }
      
      setIsLoading(false)
    }
    
    loadApiKey()
  }, [])

  // Aplicar configuração de proteção de conteúdo na inicialização
  useEffect(() => {
    const applyContentProtection = async () => {
      if (window.electronAPI?.dbGetSetting && window.electronAPI?.setContentProtection) {
        try {
          const hideFromCapture = await window.electronAPI.dbGetSetting('hide_from_capture')
          // Padrão é true (oculto) se não estiver configurado
          const shouldHide = hideFromCapture === 'true' || hideFromCapture === null
          window.electronAPI.setContentProtection(shouldHide)
        } catch (error) {
          console.error('Erro ao aplicar proteção de conteúdo:', error)
          // Em caso de erro, manter oculto por segurança
          window.electronAPI.setContentProtection(true)
        }
      }
    }
    
    applyContentProtection()
  }, [])

  const handleSaveApiKey = async (key: string) => {
    if (key.trim()) {
      localStorage.setItem('openai_api_key', key)
      
      // Salvar no banco de dados também
      if (window.electronAPI?.dbSetSetting) {
        try {
          await window.electronAPI.dbSetSetting('api_key', key)
        } catch (error) {
          console.error('Erro ao salvar API key no banco:', error)
        }
      }
      
      setApiKey(key)
      setShowConfig(false)
    }
  }

  // Estilos consistentes com Settings
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(6, 182, 212, 0.3)',
    borderRadius: '8px',
    padding: '12px 40px 12px 14px',
    fontSize: '13px',
    color: '#e5e7eb',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#d1d5db',
    marginBottom: '8px',
  }

  if (isLoading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          pointerEvents: 'auto',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/peekr_logo.png"
              alt="Peekr"
              style={{
                width: '32px',
                height: '32px',
                animation: 'pulse 2s infinite',
              }}
            />
            <span style={{ color: '#22d3ee', fontSize: '14px' }}>Carregando...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
      {/* Modal de configuração da API Key */}
      {showConfig && !apiKey ? (
        <div style={{
          pointerEvents: 'auto',
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 50,
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            width: '380px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}>
            {/* Header com Logo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
            }}>
              <img
                src="/peekr_logo.png"
                alt="Peekr Logo"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                }}
              />
              <div>
                <h1 style={{
                  color: '#22d3ee',
                  fontWeight: 700,
                  fontSize: '20px',
                  margin: 0,
                  letterSpacing: '-0.5px',
                }}>Peekr</h1>
                <p style={{
                  color: '#6b7280',
                  fontSize: '12px',
                  margin: '4px 0 0 0',
                }}>Seu assistente de IA sempre presente</p>
              </div>
            </div>
            
            {/* Descrição */}
            <p style={{
              color: '#9ca3af',
              fontSize: '13px',
              marginBottom: '20px',
              lineHeight: '1.6',
            }}>
              Configure sua chave da API OpenAI para começar. Sua chave é armazenada <strong style={{ color: '#22d3ee' }}>localmente</strong> e nunca enviada para servidores externos.
            </p>
            
            {/* Campo API Key */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>
                <Key size={14} style={{ color: '#22d3ee' }} />
                API Key da OpenAI
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveApiKey(inputValue)
                    }
                  }}
                  style={inputStyle}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{
                fontSize: '11px',
                color: '#6b7280',
                marginTop: '6px',
              }}>
                Obtenha sua chave em <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#22d3ee', textDecoration: 'none' }}
                >platform.openai.com</a>
              </p>
            </div>
            
            {/* Botão Começar */}
            <button
              onClick={() => handleSaveApiKey(inputValue)}
              disabled={!inputValue.trim()}
              style={{
                width: '100%',
                background: inputValue.trim()
                  ? 'linear-gradient(to right, #0891b2, #06b6d4)'
                  : 'rgba(55, 65, 81, 0.5)',
                color: inputValue.trim() ? 'white' : '#6b7280',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: inputValue.trim() ? '0 4px 14px rgba(6, 182, 212, 0.3)' : 'none',
              }}
            >
              Começar
            </button>
            
            {/* Atalhos de Teclado */}
            <div style={{
              marginTop: '20px',
              padding: '14px',
              background: 'rgba(2, 6, 23, 0.6)',
              borderRadius: '10px',
              border: '1px solid rgba(6, 182, 212, 0.15)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '10px',
              }}>
                <Keyboard size={12} style={{ color: '#22d3ee' }} />
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#d1d5db' }}>
                  Atalhos de Teclado
                </span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}>
                {[
                  { label: 'Toggle', key: 'Ctrl+Alt+A' },
                  { label: 'Screenshot', key: 'Ctrl+Alt+S' },
                  { label: 'Gravar', key: 'Ctrl+Alt+R' },
                  { label: 'Traduzir', key: 'Ctrl+Alt+T' },
                ].map(({ label, key }) => (
                  <div key={key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: '#9ca3af',
                  }}>
                    <span>{label}</span>
                    <kbd style={{
                      padding: '2px 6px',
                      background: '#374151',
                      borderRadius: '4px',
                      color: '#22d3ee',
                      fontSize: '9px',
                      fontFamily: 'monospace',
                    }}>{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Overlay principal */}
      {apiKey && <Overlay apiKey={apiKey} />}
    </div>
  )
}

export default App
