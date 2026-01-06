import { useState, useCallback, useRef } from 'react'
import { AIMessage } from '@shared/types'
import {
  OpenAIService,
  StreamOptions,
  MODEL_CONTEXT_INFO,
  TokenUsage,
  CostInfo,
  calculateCost,
  calculateWhisperCost,
  calculateVisionCost
} from '../services/openai-service'

export interface ContextOptions {
  maxContextTokens?: number  // Limite de tokens de contexto
  autoCondense?: boolean     // Se deve auto-condensar quando exceder
  model?: string             // Modelo para obter limites
}

// Interface para estatísticas de custos
export interface CostStats {
  chatCost: number           // Custo de mensagens de chat
  audioCost: number          // Custo de transcrições de áudio
  imageCost: number          // Custo de análise de imagens
  totalCost: number          // Custo total em USD
  requestCount: number       // Número de requisições
  audioMinutes: number       // Minutos de áudio processados
  imagesAnalyzed: number     // Imagens analisadas
}

// Interface para estatísticas de tokens
export interface TokenStats {
  promptTokens: number       // Tokens de entrada (última requisição)
  completionTokens: number   // Tokens de saída (última requisição)
  totalTokens: number        // Total (última requisição)
  cumulativeTokens: number   // Total acumulado na sessão
  estimatedContextTokens: number  // Estimativa de tokens no contexto atual
  contextLimit: number       // Limite de contexto do modelo
  cachedTokens?: number      // Tokens em cache (se disponível)
  cost?: CostInfo            // Custo da última requisição
}

export const useAIStreaming = (apiKey: string) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCondensing, setIsCondensing] = useState(false)
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cumulativeTokens: 0,
    estimatedContextTokens: 0,
    contextLimit: 128000
  })
  
  // Estado para rastrear custos acumulados
  const [costStats, setCostStats] = useState<CostStats>(() => {
    // Tentar carregar do localStorage
    const saved = localStorage.getItem('ai-cost-stats')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Ignorar erro de parse
      }
    }
    return {
      chatCost: 0,
      audioCost: 0,
      imageCost: 0,
      totalCost: 0,
      requestCount: 0,
      audioMinutes: 0,
      imagesAnalyzed: 0
    }
  })
  
  const serviceRef = useRef<OpenAIService | null>(null)
  
  // Salvar custos no localStorage quando mudar
  const saveCostStats = useCallback((stats: CostStats) => {
    localStorage.setItem('ai-cost-stats', JSON.stringify(stats))
  }, [])

  if (!serviceRef.current && apiKey) {
    try {
      serviceRef.current = new OpenAIService(apiKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize OpenAI service')
    }
  }

  // Função para condensar contexto - mantém apenas as mensagens mais recentes (fallback simples)
  const condenseContextSimple = useCallback((messages: AIMessage[], maxMessages: number = 20): AIMessage[] => {
    if (messages.length <= maxMessages) {
      return messages
    }

    // Sempre manter a primeira mensagem se for system prompt
    const hasSystemMessage = messages[0]?.role === 'system'
    const systemMessage = hasSystemMessage ? [messages[0]] : []
    
    // Pegar as últimas mensagens (excluindo system se existir)
    const startIndex = hasSystemMessage ? 1 : 0
    const recentMessages = messages.slice(startIndex).slice(-(maxMessages - systemMessage.length))
    
    return [...systemMessage, ...recentMessages]
  }, [])

  // Função para condensar contexto baseado em tokens com resumo inteligente
  const condenseContextSmart = useCallback(async (
    messages: AIMessage[],
    maxTokens: number,
    autoCondense: boolean
  ): Promise<AIMessage[]> => {
    if (!serviceRef.current) {
      return condenseContextSimple(messages, 20)
    }

    // Estimar tokens atuais
    const currentTokens = serviceRef.current.estimateMessagesTokens(messages)
    
    console.log(`[Context] Tokens estimados: ${currentTokens}, limite: ${maxTokens}`)
    
    // Se está dentro do limite, retornar mensagens originais
    if (currentTokens <= maxTokens) {
      return messages
    }

    console.log(`[Context] Excedeu limite! Auto-condense: ${autoCondense}`)

    // Se auto-condense está ativado, usar IA para resumir
    if (autoCondense) {
      try {
        setIsCondensing(true)
        const { condensedMessages } = await serviceRef.current.condenseMessages(messages, 2000)
        setIsCondensing(false)
        
        const newTokens = serviceRef.current.estimateMessagesTokens(condensedMessages)
        console.log(`[Context] Após condensamento: ${newTokens} tokens (${condensedMessages.length} mensagens)`)
        
        return condensedMessages
      } catch (err) {
        console.error('[Context] Erro no condensamento:', err)
        setIsCondensing(false)
        // Fallback para condensamento simples
        return condenseContextSimple(messages, 20)
      }
    }

    // Se auto-condense está desativado, apenas cortar mensagens antigas
    // Calcular quantas mensagens manter baseado no limite de tokens
    let messagesToKeep = messages.length
    let estimatedTokens = currentTokens
    
    while (estimatedTokens > maxTokens && messagesToKeep > 4) {
      messagesToKeep = Math.floor(messagesToKeep * 0.7) // Reduzir 30%
      const trimmedMessages = condenseContextSimple(messages, messagesToKeep)
      estimatedTokens = serviceRef.current.estimateMessagesTokens(trimmedMessages)
    }
    
    return condenseContextSimple(messages, messagesToKeep)
  }, [condenseContextSimple])

  const streamAIResponse = useCallback(
    async (
      messages: AIMessage[],
      onChunk: (chunk: string) => void,
      onComplete: () => void,
      options?: StreamOptions,
      contextOptions?: ContextOptions
    ) => {
      if (!serviceRef.current) {
        setError('OpenAI service not initialized')
        return
      }

      setIsLoading(true)
      setError(null)

      // Obter configurações de contexto
      const model = options?.model || contextOptions?.model || 'gpt-4o'
      const modelInfo = MODEL_CONTEXT_INFO[model] || { contextWindow: 128000, maxOutput: 16384 }
      
      // Usar limite configurado ou máximo do modelo (reservando espaço para resposta)
      const maxContextTokens = contextOptions?.maxContextTokens || (modelInfo.contextWindow - modelInfo.maxOutput)
      const autoCondense = contextOptions?.autoCondense !== false // Padrão: true

      // Atualizar limite de contexto nas estatísticas
      setTokenStats(prev => ({
        ...prev,
        contextLimit: modelInfo.contextWindow
      }))

      // Condensar contexto baseado em tokens
      const condensedMessages = await condenseContextSmart(messages, maxContextTokens, autoCondense)
      
      // Estimar tokens do contexto atual
      const estimatedContextTokens = serviceRef.current.estimateMessagesTokens(condensedMessages)
      
      console.log(`[Context] Mensagens originais: ${messages.length}, condensadas: ${condensedMessages.length}`)
      console.log(`[Context] Tokens estimados no contexto: ${estimatedContextTokens}`)

      await serviceRef.current.streamChat(
        condensedMessages,
        options,
        onChunk,
        (errorMessage) => {
          setError(errorMessage)
        },
        (usage?: TokenUsage) => {
          setIsLoading(false)
          
          // Atualizar estatísticas de tokens com dados REAIS da API
          if (usage) {
            // Calcular custo desta requisição
            const cost = calculateCost(
              model,
              usage.promptTokens,
              usage.completionTokens,
              usage.cachedTokens || 0
            )
            
            setTokenStats(prev => ({
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
              cumulativeTokens: prev.cumulativeTokens + usage.totalTokens,
              estimatedContextTokens: usage.promptTokens, // Usar valor real da API
              contextLimit: modelInfo.contextWindow,
              cachedTokens: usage.cachedTokens,
              cost // Adicionar custo da última requisição
            }))
            
            // Atualizar custos acumulados
            setCostStats(prev => {
              const newStats = {
                ...prev,
                chatCost: prev.chatCost + cost.totalCost,
                totalCost: prev.totalCost + cost.totalCost,
                requestCount: prev.requestCount + 1
              }
              saveCostStats(newStats)
              return newStats
            })
            
            console.log(`[Tokens] Real usage - Prompt: ${usage.promptTokens}, Completion: ${usage.completionTokens}, Total: ${usage.totalTokens}`)
            console.log(`[Cost] Request cost: $${cost.totalCost.toFixed(6)} (Input: $${cost.inputCost.toFixed(6)}, Output: $${cost.outputCost.toFixed(6)})`)
          } else {
            // Fallback para estimativa se API não retornar usage
            setTokenStats(prev => ({
              ...prev,
              estimatedContextTokens
            }))
          }
          
          onComplete()
        }
      )
    },
    [condenseContextSmart, saveCostStats]
  )

  // Função para condensar contexto manualmente
  const condenseContextManually = useCallback(
    async (messages: AIMessage[]): Promise<AIMessage[]> => {
      if (!serviceRef.current) {
        setError('OpenAI service not initialized')
        return messages
      }

      try {
        setIsCondensing(true)
        setError(null)
        
        const { condensedMessages, usage } = await serviceRef.current.condenseMessages(messages, 2000)
        
        // Atualizar estatísticas se tiver uso de tokens
        if (usage) {
          setTokenStats(prev => ({
            ...prev,
            cumulativeTokens: prev.cumulativeTokens + usage.totalTokens
          }))
        }
        
        // Estimar novos tokens do contexto
        const newEstimate = serviceRef.current.estimateMessagesTokens(condensedMessages)
        setTokenStats(prev => ({
          ...prev,
          estimatedContextTokens: newEstimate
        }))
        
        setIsCondensing(false)
        return condensedMessages
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Condensation failed'
        setError(errorMessage)
        setIsCondensing(false)
        return messages
      }
    },
    []
  )

  // Função para estimar tokens de mensagens
  const estimateTokens = useCallback(
    (messages: AIMessage[]): number => {
      if (!serviceRef.current) return 0
      return serviceRef.current.estimateMessagesTokens(messages)
    },
    []
  )

  // Função para atualizar estimativa de contexto
  const updateContextEstimate = useCallback(
    (messages: AIMessage[], model: string = 'gpt-4o') => {
      if (!serviceRef.current) return
      
      const modelInfo = MODEL_CONTEXT_INFO[model] || { contextWindow: 128000, maxOutput: 16384 }
      const estimated = serviceRef.current.estimateMessagesTokens(messages)
      
      setTokenStats(prev => ({
        ...prev,
        estimatedContextTokens: estimated,
        contextLimit: modelInfo.contextWindow
      }))
    },
    []
  )

  // Função para resetar estatísticas de tokens
  const resetTokenStats = useCallback(() => {
    setTokenStats({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cumulativeTokens: 0,
      estimatedContextTokens: 0,
      contextLimit: 128000
    })
  }, [])

  const translateText = useCallback(
    async (text: string, targetLanguage: string = 'Portuguese'): Promise<string> => {
      if (!serviceRef.current) {
        setError('OpenAI service not initialized')
        return ''
      }

      try {
        setIsLoading(true)
        setError(null)
        const translation = await serviceRef.current.translateText(text, targetLanguage)
        setIsLoading(false)
        return translation
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Translation failed'
        setError(errorMessage)
        setIsLoading(false)
        return ''
      }
    },
    []
  )

  const analyzeImage = useCallback(
    async (imageBase64: string, prompt?: string): Promise<string> => {
      if (!serviceRef.current) {
        setError('OpenAI service not initialized')
        return ''
      }

      try {
        setIsLoading(true)
        setError(null)
        const analysis = await serviceRef.current.analyzeImage(imageBase64, prompt)
        setIsLoading(false)
        
        // Calcular custo da análise de imagem
        // Estimar tamanho da imagem para determinar tiles (high detail)
        // Base64 ~= 4/3 do tamanho original, imagem típica ~500KB = ~375KB base64
        const imageSizeKB = (imageBase64.length * 3) / 4 / 1024
        const tiles = Math.max(1, Math.ceil(imageSizeKB / 512)) // ~512KB por tile
        const imageCost = calculateVisionCost('high', tiles)
        
        // Atualizar custos acumulados
        setCostStats(prev => {
          const newStats = {
            ...prev,
            imageCost: prev.imageCost + imageCost.totalCost,
            totalCost: prev.totalCost + imageCost.totalCost,
            imagesAnalyzed: prev.imagesAnalyzed + 1
          }
          saveCostStats(newStats)
          return newStats
        })
        
        console.log(`[Cost] Image analysis cost: $${imageCost.totalCost.toFixed(6)} (${tiles} tiles)`)
        
        return analysis
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Image analysis failed'
        setError(errorMessage)
        setIsLoading(false)
        return ''
      }
    },
    [saveCostStats]
  )

  const transcribeAudio = useCallback(
    async (audioBlob: Blob, language: string = 'pt'): Promise<{ text: string; audioUrl: string }> => {
      if (!serviceRef.current) {
        setError('OpenAI service not initialized')
        return { text: '', audioUrl: '' }
      }

      try {
        setIsLoading(true)
        setError(null)
        
        // Estimar duração do áudio baseado no tamanho do blob
        // WebM/Opus típico: ~12KB/segundo, WAV: ~176KB/segundo
        const isWebm = audioBlob.type.includes('webm') || audioBlob.type.includes('opus')
        const bytesPerSecond = isWebm ? 12000 : 176000
        const estimatedDurationSeconds = audioBlob.size / bytesPerSecond
        
        const result = await serviceRef.current.transcribeAudio(audioBlob, language)
        setIsLoading(false)
        
        // Calcular custo da transcrição (Whisper)
        const audioCost = calculateWhisperCost(estimatedDurationSeconds)
        const audioMinutes = estimatedDurationSeconds / 60
        
        // Atualizar custos acumulados
        setCostStats(prev => {
          const newStats = {
            ...prev,
            audioCost: prev.audioCost + audioCost.totalCost,
            totalCost: prev.totalCost + audioCost.totalCost,
            audioMinutes: prev.audioMinutes + audioMinutes
          }
          saveCostStats(newStats)
          return newStats
        })
        
        console.log(`[Cost] Audio transcription cost: $${audioCost.totalCost.toFixed(6)} (${audioMinutes.toFixed(2)} min)`)
        
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Transcription failed'
        setError(errorMessage)
        setIsLoading(false)
        return { text: '', audioUrl: '' }
      }
    },
    [saveCostStats]
  )

  const updateApiKey = useCallback((newApiKey: string) => {
    try {
      serviceRef.current = new OpenAIService(newApiKey)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API key')
    }
  }, [])

  // Função para resetar custos acumulados
  const resetCostStats = useCallback(() => {
    const emptyStats: CostStats = {
      chatCost: 0,
      audioCost: 0,
      imageCost: 0,
      totalCost: 0,
      requestCount: 0,
      audioMinutes: 0,
      imagesAnalyzed: 0
    }
    setCostStats(emptyStats)
    saveCostStats(emptyStats)
  }, [saveCostStats])

  return {
    streamAIResponse,
    translateText,
    analyzeImage,
    transcribeAudio,
    updateApiKey,
    condenseContextManually,
    estimateTokens,
    updateContextEstimate,
    resetTokenStats,
    resetCostStats,
    isLoading,
    isCondensing,
    error,
    tokenStats,
    costStats,
  }
}
