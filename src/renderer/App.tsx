import { useState, useEffect } from 'react'
import { Overlay } from './components/Overlay'

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [showConfig, setShowConfig] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)

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

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-transparent flex items-center justify-center">
        <div className="pointer-events-auto bg-gray-900/95 border border-cyan-500/30 rounded-xl p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-cyan-400">Carregando...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-transparent">
      {/* Modal de configuração da API Key */}
      {showConfig && !apiKey ? (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
          <div className="bg-gray-900/95 border border-cyan-500/30 rounded-2xl p-6 w-[420px] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl">🤖</span>
              </div>
              <div>
                <h1 className="text-cyan-400 font-bold text-lg">AI Overlay Agent</h1>
                <p className="text-gray-500 text-xs">Assistente de IA em tempo real</p>
              </div>
            </div>
            
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              Digite sua chave da API OpenAI para começar. Sua chave é armazenada localmente e nunca enviada para servidores externos.
            </p>
            
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🔑 API Key
              </label>
              <input
                type="password"
                placeholder="sk-..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveApiKey(inputValue)
                  }
                }}
                className="w-full bg-gray-800/80 border border-gray-600/50 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
            </div>
            
            <button
              onClick={() => handleSaveApiKey(inputValue)}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl px-4 py-3 font-semibold transition-all shadow-lg shadow-cyan-500/20"
            >
              Começar
            </button>
            
            <div className="mt-5 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <p className="text-gray-500 text-xs mb-2">
                <span className="text-cyan-400 font-medium">⌨️ Atalhos:</span>
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-cyan-300 text-[10px]">Ctrl+Alt+A</kbd>
                  <span>Toggle</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-cyan-300 text-[10px]">Ctrl+Alt+S</kbd>
                  <span>Screenshot</span>
                </div>
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
