import OpenAI from 'openai'
import { AIMessage } from '@shared/types'

export interface StreamOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

// Interface para informações de uso de tokens
export interface TokenUsage {
  promptTokens: number      // Tokens enviados (input)
  completionTokens: number  // Tokens recebidos (output)
  totalTokens: number       // Total
  cachedTokens?: number     // Tokens em cache (se aplicável)
  cost?: CostInfo           // Custo calculado
}

// Interface para informações de custo
export interface CostInfo {
  inputCost: number         // Custo dos tokens de entrada em USD
  outputCost: number        // Custo dos tokens de saída em USD
  totalCost: number         // Custo total em USD
  model: string             // Modelo usado
}

// Preços por 1M tokens (em USD) - Atualizado Jan 2025
// Fonte: https://openai.com/pricing
export const MODEL_PRICING: Record<string, { input: number; output: number; cached?: number }> = {
  // GPT-4o Series
  'gpt-4o': { input: 2.50, output: 10.00, cached: 1.25 },
  'gpt-4o-2024-08-06': { input: 2.50, output: 10.00, cached: 1.25 },
  'gpt-4o-2024-05-13': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, cached: 0.075 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.60, cached: 0.075 },
  'chatgpt-4o-latest': { input: 5.00, output: 15.00 },
  
  // GPT-4 Turbo Series
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4-turbo-2024-04-09': { input: 10.00, output: 30.00 },
  'gpt-4-turbo-preview': { input: 10.00, output: 30.00 },
  
  // GPT-4 Series
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-0613': { input: 30.00, output: 60.00 },
  'gpt-4-32k': { input: 60.00, output: 120.00 },
  'gpt-4-32k-0613': { input: 60.00, output: 120.00 },
  
  // GPT-3.5 Series
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-0125': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-1106': { input: 1.00, output: 2.00 },
  'gpt-3.5-turbo-16k': { input: 3.00, output: 4.00 },
  
  // o1 Series (Reasoning Models)
  'o1': { input: 15.00, output: 60.00, cached: 7.50 },
  'o1-2024-12-17': { input: 15.00, output: 60.00, cached: 7.50 },
  'o1-preview': { input: 15.00, output: 60.00 },
  'o1-preview-2024-09-12': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00, cached: 1.50 },
  'o1-mini-2024-09-12': { input: 3.00, output: 12.00, cached: 1.50 },
  
  // o3 Series
  'o3-mini': { input: 1.10, output: 4.40, cached: 0.55 },
  'o3-mini-2025-01-31': { input: 1.10, output: 4.40, cached: 0.55 },
  
  // Whisper (Audio) - preço por minuto convertido para tokens aproximados
  // $0.006/min ≈ $0.0001/segundo ≈ ~150 tokens/segundo
  'whisper-1': { input: 0.006, output: 0 }, // Preço especial por minuto
  
  // Vision (imagens) - custo adicional por imagem
  // Low detail: $0.00255, High detail: $0.00765 base + $0.00255 por tile
  'vision-low': { input: 2.55, output: 0 },
  'vision-high': { input: 7.65, output: 0 },
}

/**
 * Calcula o custo de uma requisição baseado no uso de tokens
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number = 0
): CostInfo {
  // Obter preços do modelo (fallback para gpt-4o se não encontrar)
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o']
  
  // Calcular tokens não-cached
  const nonCachedPromptTokens = promptTokens - cachedTokens
  
  // Calcular custos (preços são por 1M tokens)
  const cachedCost = cachedTokens > 0 && pricing.cached
    ? (cachedTokens / 1_000_000) * pricing.cached
    : 0
  const inputCost = (nonCachedPromptTokens / 1_000_000) * pricing.input + cachedCost
  const outputCost = (completionTokens / 1_000_000) * pricing.output
  const totalCost = inputCost + outputCost
  
  return {
    inputCost,
    outputCost,
    totalCost,
    model
  }
}

/**
 * Calcula o custo de transcrição de áudio (Whisper)
 * @param durationSeconds Duração do áudio em segundos
 */
export function calculateWhisperCost(durationSeconds: number): CostInfo {
  // Whisper cobra $0.006 por minuto
  const minutes = durationSeconds / 60
  const totalCost = minutes * 0.006
  
  return {
    inputCost: totalCost,
    outputCost: 0,
    totalCost,
    model: 'whisper-1'
  }
}

/**
 * Calcula o custo de análise de imagem (Vision)
 * @param detail 'low' ou 'high' - nível de detalhe da análise
 * @param tiles Número de tiles para high detail (1 tile = 512x512)
 */
export function calculateVisionCost(detail: 'low' | 'high' = 'high', tiles: number = 1): CostInfo {
  let totalCost: number
  
  if (detail === 'low') {
    totalCost = 0.00255 // Custo fixo para low detail
  } else {
    // High detail: base + custo por tile
    totalCost = 0.00765 + (tiles * 0.00255)
  }
  
  return {
    inputCost: totalCost,
    outputCost: 0,
    totalCost,
    model: `vision-${detail}`
  }
}

// Informações de contexto dos modelos OpenAI (não disponível via API)
// Fonte: https://platform.openai.com/docs/models
export interface ModelContextInfo {
  contextWindow: number  // Total de tokens disponíveis
  maxOutput: number      // Máximo de tokens de saída
  name: string           // Nome amigável
  supportsVision?: boolean
  supportsAudio?: boolean
}

export const MODEL_CONTEXT_INFO: Record<string, ModelContextInfo> = {
  // GPT-4o Series
  'gpt-4o': {
    contextWindow: 128000,
    maxOutput: 16384,
    name: 'GPT-4o',
    supportsVision: true
  },
  'gpt-4o-2024-08-06': {
    contextWindow: 128000,
    maxOutput: 16384,
    name: 'GPT-4o (Aug 2024)',
    supportsVision: true
  },
  'gpt-4o-2024-05-13': {
    contextWindow: 128000,
    maxOutput: 4096,
    name: 'GPT-4o (May 2024)',
    supportsVision: true
  },
  'gpt-4o-mini': {
    contextWindow: 128000,
    maxOutput: 16384,
    name: 'GPT-4o Mini',
    supportsVision: true
  },
  'gpt-4o-mini-2024-07-18': {
    contextWindow: 128000,
    maxOutput: 16384,
    name: 'GPT-4o Mini (Jul 2024)',
    supportsVision: true
  },
  'chatgpt-4o-latest': {
    contextWindow: 128000,
    maxOutput: 16384,
    name: 'ChatGPT-4o Latest',
    supportsVision: true
  },
  
  // GPT-4 Turbo Series
  'gpt-4-turbo': {
    contextWindow: 128000,
    maxOutput: 4096,
    name: 'GPT-4 Turbo',
    supportsVision: true
  },
  'gpt-4-turbo-2024-04-09': {
    contextWindow: 128000,
    maxOutput: 4096,
    name: 'GPT-4 Turbo (Apr 2024)',
    supportsVision: true
  },
  'gpt-4-turbo-preview': {
    contextWindow: 128000,
    maxOutput: 4096,
    name: 'GPT-4 Turbo Preview',
    supportsVision: false
  },
  
  // GPT-4 Series
  'gpt-4': {
    contextWindow: 8192,
    maxOutput: 4096,
    name: 'GPT-4'
  },
  'gpt-4-0613': {
    contextWindow: 8192,
    maxOutput: 4096,
    name: 'GPT-4 (Jun 2023)'
  },
  'gpt-4-32k': {
    contextWindow: 32768,
    maxOutput: 4096,
    name: 'GPT-4 32K'
  },
  'gpt-4-32k-0613': {
    contextWindow: 32768,
    maxOutput: 4096,
    name: 'GPT-4 32K (Jun 2023)'
  },
  
  // GPT-3.5 Series
  'gpt-3.5-turbo': {
    contextWindow: 16385,
    maxOutput: 4096,
    name: 'GPT-3.5 Turbo'
  },
  'gpt-3.5-turbo-0125': {
    contextWindow: 16385,
    maxOutput: 4096,
    name: 'GPT-3.5 Turbo (Jan 2025)'
  },
  'gpt-3.5-turbo-1106': {
    contextWindow: 16385,
    maxOutput: 4096,
    name: 'GPT-3.5 Turbo (Nov 2023)'
  },
  'gpt-3.5-turbo-16k': {
    contextWindow: 16385,
    maxOutput: 4096,
    name: 'GPT-3.5 Turbo 16K'
  },
  
  // o1 Series (Reasoning Models)
  'o1': {
    contextWindow: 200000,
    maxOutput: 100000,
    name: 'o1'
  },
  'o1-2024-12-17': {
    contextWindow: 200000,
    maxOutput: 100000,
    name: 'o1 (Dec 2024)'
  },
  'o1-preview': {
    contextWindow: 128000,
    maxOutput: 32768,
    name: 'o1 Preview'
  },
  'o1-preview-2024-09-12': {
    contextWindow: 128000,
    maxOutput: 32768,
    name: 'o1 Preview (Sep 2024)'
  },
  'o1-mini': {
    contextWindow: 128000,
    maxOutput: 65536,
    name: 'o1 Mini'
  },
  'o1-mini-2024-09-12': {
    contextWindow: 128000,
    maxOutput: 65536,
    name: 'o1 Mini (Sep 2024)'
  },
  
  // o3 Series
  'o3-mini': {
    contextWindow: 200000,
    maxOutput: 100000,
    name: 'o3 Mini'
  },
  'o3-mini-2025-01-31': {
    contextWindow: 200000,
    maxOutput: 100000,
    name: 'o3 Mini (Jan 2025)'
  },
}

export interface AvailableModel {
  id: string
  name: string
  contextWindow: number
  maxOutput: number
  supportsVision?: boolean
  supportsAudio?: boolean
  ownedBy: string
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant integrated into a desktop overlay. 
You provide concise, actionable responses. Keep responses brief and focused.
When analyzing screenshots, provide specific insights and recommendations.
When translating, maintain context and nuance.
Always be respectful and professional.`

export class OpenAIService {
  private client: OpenAI | null = null
  private apiKey: string = ''
  private audioContext: AudioContext | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.initializeClient()
  }

  private initializeClient(): void {
    if (!this.apiKey) {
      throw new Error('API key is required')
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
    })
  }

  async streamChat(
    messages: AIMessage[],
    options: StreamOptions = {},
    onChunk: (chunk: string) => void,
    onError: (error: string) => void,
    onComplete: (usage?: TokenUsage) => void
  ): Promise<void> {
    if (!this.client) {
      onError('OpenAI client not initialized')
      return
    }

    const {
      model = 'gpt-4o',
      temperature = 0.7,
      maxTokens = 500,
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
    } = options

    try {
      const formattedMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
      ]

      const stream = await this.client.chat.completions.create({
        model,
        messages: formattedMessages,
        stream: true,
        stream_options: { include_usage: true }, // Incluir uso de tokens no stream
        temperature,
        max_tokens: maxTokens,
      })

      let tokenUsage: TokenUsage | undefined
      let chunkCount = 0

      for await (const chunk of stream) {
        chunkCount++
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          onChunk(content)
        }
        
        // Capturar uso de tokens quando disponível (último chunk)
        // O usage vem no último chunk quando stream_options.include_usage = true
        if (chunk.usage) {
          tokenUsage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
            cachedTokens: (chunk.usage as any).prompt_tokens_details?.cached_tokens
          }
          console.log('[OpenAI] ✅ Token usage received:', tokenUsage)
        }
        
        // Debug: log último chunk para verificar estrutura
        if (chunk.choices[0]?.finish_reason) {
          console.log('[OpenAI] 📊 Stream finished, chunk count:', chunkCount, 'finish_reason:', chunk.choices[0].finish_reason)
          console.log('[OpenAI] 📊 Final chunk has usage?', !!chunk.usage, chunk.usage ? JSON.stringify(chunk.usage) : 'N/A')
        }
      }

      console.log('[OpenAI] 🏁 Stream complete, tokenUsage:', tokenUsage ? JSON.stringify(tokenUsage) : 'undefined')
      onComplete(tokenUsage)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      onError(errorMessage)
    }
  }

  async translateText(
    text: string,
    targetLanguage: string = 'Portuguese'
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized')
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: `Translate the following text to ${targetLanguage}. Return only the translation, no explanations:\n\n${text}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      })

      return response.choices[0]?.message?.content || ''
    } catch (error) {
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeImage(
    imageBase64: string,
    prompt: string = 'Analyze this image and provide insights'
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized')
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'auto',
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
      })

      return response.choices[0]?.message?.content || ''
    } catch (error) {
      throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Função para obter ou criar AudioContext reutilizável
  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return this.audioContext
  }

  // Função para converter áudio para WAV usando Web Audio API
  private async convertToWav(audioBlob: Blob): Promise<Blob> {
    try {
      console.log('[Convert] Convertendo áudio para WAV...')
      
      // Usar AudioContext reutilizável
      const audioContext = this.getAudioContext()
      
      // Converter blob para ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer()
      
      // Criar uma cópia do ArrayBuffer para evitar problemas de reutilização
      const bufferCopy = arrayBuffer.slice(0)
      
      // Decodificar áudio
      const audioBuffer = await audioContext.decodeAudioData(bufferCopy)
      
      // Configurações WAV
      const sampleRate = audioBuffer.sampleRate
      const numberOfChannels = audioBuffer.numberOfChannels
      const length = audioBuffer.length
      
      console.log('[Convert] Audio info:', { sampleRate, numberOfChannels, length })
      
      // Criar buffer WAV
      const wavBuffer = this.createWavBuffer(audioBuffer, sampleRate, numberOfChannels)
      
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' })
      console.log('[Convert] WAV criado:', wavBlob.size, 'bytes')
      
      return wavBlob
    } catch (error) {
      console.error('[Convert] Erro na conversão:', error)
      
      // Se falhar na conversão, tentar estratégias alternativas
      console.log('[Convert] Tentando estratégia alternativa...')
      
      try {
        // Estratégia 1: Usar o blob original com tipo correto
        if (audioBlob.type.includes('webm') || audioBlob.type.includes('opus')) {
          console.log('[Convert] Usando WebM/Opus original')
          return new Blob([audioBlob], { type: 'audio/webm' })
        }
        
        // Estratégia 2: Forçar como MP3 se possível
        if (audioBlob.size > 1000) { // Só se tiver conteúdo significativo
          console.log('[Convert] Tentando como MP3')
          return new Blob([audioBlob], { type: 'audio/mp3' })
        }
        
      } catch (fallbackError) {
        console.error('[Convert] Erro na estratégia alternativa:', fallbackError)
      }
      
      // Última tentativa: retornar o blob original
      return audioBlob
    }
  }

  // Função para criar buffer WAV
  private createWavBuffer(audioBuffer: AudioBuffer, sampleRate: number, numberOfChannels: number): ArrayBuffer {
    const length = audioBuffer.length
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(arrayBuffer)
    
    // Header WAV
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    // RIFF header
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, 'WAVE')
    
    // fmt chunk
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // chunk size
    view.setUint16(20, 1, true) // PCM format
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true) // byte rate
    view.setUint16(32, numberOfChannels * 2, true) // block align
    view.setUint16(34, 16, true) // bits per sample
    
    // data chunk
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * 2, true)
    
    // Audio data
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }
    
    return arrayBuffer
  }

  async transcribeAudio(audioBlob: Blob, language: string = 'pt'): Promise<{ text: string; audioUrl: string }> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized')
    }

    // Variáveis para capturar resultado antes de qualquer erro
    let transcriptionText = ''
    let audioUrl = ''
    let transcriptionSuccess = false

    try {
      console.log('[Transcribe] Original blob:', audioBlob.type, audioBlob.size, 'bytes')
      
      // Converter blob para base64 data URL para persistência
      // Isso permite que o áudio seja salvo no banco e carregado posteriormente
      audioUrl = await this.blobToDataUrl(audioBlob)
      console.log('[Transcribe] Audio converted to data URL, length:', audioUrl.length)
      
      // Estratégia múltipla: tentar vários formatos até um funcionar
      const strategies = [
        // Estratégia 1: Converter para WAV
        async () => {
          console.log('[Transcribe] Estratégia 1: Convertendo para WAV...')
          const wavBlob = await this.convertToWav(audioBlob)
          return new File([wavBlob], `audio_${Date.now()}.wav`, { type: 'audio/wav' })
        },
        
        // Estratégia 2: Usar WebM original
        async () => {
          console.log('[Transcribe] Estratégia 2: Usando WebM original...')
          return new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' })
        },
        
        // Estratégia 3: Forçar como MP3
        async () => {
          console.log('[Transcribe] Estratégia 3: Tentando como MP3...')
          return new File([audioBlob], `audio_${Date.now()}.mp3`, { type: 'audio/mp3' })
        },
        
        // Estratégia 4: Usar OGG
        async () => {
          console.log('[Transcribe] Estratégia 4: Tentando como OGG...')
          return new File([audioBlob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' })
        }
      ]
      
      let lastError: any = null
      
      // Tentar cada estratégia até uma funcionar
      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`[Transcribe] Tentando estratégia ${i + 1}/${strategies.length}...`)
          
          const audioFile = await strategies[i]()
          console.log('[Transcribe] File created:', audioFile.name, audioFile.type, audioFile.size)
          
          // Tentar transcrever com este formato
          const response = await this.client.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: language,
            response_format: 'text',
            temperature: 0.0,
          })
          
          // Se chegou até aqui, funcionou!
          transcriptionText = response
          transcriptionSuccess = true
          
          console.log(`[Transcribe] ✅ Estratégia ${i + 1} funcionou! Response length:`, response.length)
          console.log('[Transcribe] ✅ Response text:', response.substring(0, 100) + '...')
          
          return {
            text: transcriptionText,
            audioUrl: audioUrl
          }
          
        } catch (strategyError) {
          console.warn(`[Transcribe] ❌ Estratégia ${i + 1} falhou:`, strategyError)
          lastError = strategyError
          
          // Continuar para próxima estratégia
          continue
        }
      }
      
      // Se chegou aqui, todas as estratégias falharam
      throw lastError || new Error('Todas as estratégias de conversão falharam')
      
    } catch (error) {
      console.error('[Transcribe] Error details:', error)
      
      // CRÍTICO: Se temos texto transcrito, retornar sucesso mesmo com erro
      if (transcriptionSuccess && transcriptionText.trim()) {
        console.log('[Transcribe] 🔄 Retornando sucesso apesar do erro (texto capturado)')
        return {
          text: transcriptionText,
          audioUrl: audioUrl
        }
      }
      
      // Se realmente não temos texto, tratar como erro mas NÃO lançar exceção
      console.log('[Transcribe] 💥 Todas as estratégias falharam - sem texto capturado')
      
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
        
        // Se for erro de formato, dar informação mais específica
        if (errorMessage.includes('Invalid file format') || errorMessage.includes('format') || errorMessage.includes('could not be decoded')) {
          errorMessage = `Todas as estratégias de formato falharam. Último erro: ${errorMessage}`
        }
      }
      
      // IMPORTANTE: Retornar objeto vazio ao invés de lançar erro
      // Isso evita que a gravação pare
      return {
        text: '', // Texto vazio indica falha
        audioUrl: audioUrl, // URL ainda funciona para debug
        error: errorMessage // Adicionar campo de erro opcional
      } as any
    }
  }

  // Método para converter Blob para Data URL (base64)
  // Isso permite persistir o áudio no banco de dados
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to convert blob to data URL'))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }

  // Método para limpar recursos
  cleanup(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
    this.initializeClient()
  }

  isInitialized(): boolean {
    return this.client !== null && this.apiKey !== ''
  }

  /**
   * Lista os modelos de chat disponíveis na conta do usuário
   * Combina dados da API com informações de contexto locais
   */
  async listAvailableModels(): Promise<AvailableModel[]> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized')
    }

    try {
      const response = await this.client.models.list()
      
      // Filtrar apenas modelos de chat (gpt-*, o1-*, o3-*, chatgpt-*)
      const chatModels = response.data.filter(model => {
        const id = model.id.toLowerCase()
        return (
          (id.startsWith('gpt-') ||
           id.startsWith('o1') ||
           id.startsWith('o3') ||
           id.startsWith('chatgpt-')) &&
          // Excluir modelos de embedding, instruct, etc
          !id.includes('instruct') &&
          !id.includes('embedding') &&
          !id.includes('realtime') &&
          !id.includes('audio') &&
          !id.includes('search') &&
          !id.includes('similarity') &&
          !id.includes('edit') &&
          !id.includes('insert')
        )
      })

      // Mapear para AvailableModel com informações de contexto
      const availableModels: AvailableModel[] = chatModels.map(model => {
        const contextInfo = MODEL_CONTEXT_INFO[model.id]
        
        // Se não temos info de contexto, usar valores padrão baseados no nome
        const defaultContext = this.getDefaultContextForModel(model.id)
        
        return {
          id: model.id,
          name: contextInfo?.name || this.formatModelName(model.id),
          contextWindow: contextInfo?.contextWindow || defaultContext.contextWindow,
          maxOutput: contextInfo?.maxOutput || defaultContext.maxOutput,
          supportsVision: contextInfo?.supportsVision || model.id.includes('4o') || model.id.includes('vision'),
          supportsAudio: contextInfo?.supportsAudio || false,
          ownedBy: model.owned_by
        }
      })

      // Ordenar por nome (modelos mais recentes primeiro)
      return availableModels.sort((a, b) => {
        // Priorizar modelos principais
        const priority = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini']
        const aIndex = priority.findIndex(p => a.id.startsWith(p))
        const bIndex = priority.findIndex(p => b.id.startsWith(p))
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error('[OpenAI] Error listing models:', error)
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Obtém informações de contexto para um modelo específico
   */
  getModelContextInfo(modelId: string): ModelContextInfo | null {
    return MODEL_CONTEXT_INFO[modelId] || null
  }

  /**
   * Retorna valores padrão de contexto baseado no nome do modelo
   */
  private getDefaultContextForModel(modelId: string): { contextWindow: number; maxOutput: number } {
    const id = modelId.toLowerCase()
    
    // o1/o3 series - contexto muito grande
    if (id.startsWith('o1') || id.startsWith('o3')) {
      return { contextWindow: 128000, maxOutput: 65536 }
    }
    
    // GPT-4o series
    if (id.includes('4o')) {
      return { contextWindow: 128000, maxOutput: 16384 }
    }
    
    // GPT-4 Turbo
    if (id.includes('4-turbo')) {
      return { contextWindow: 128000, maxOutput: 4096 }
    }
    
    // GPT-4 32K
    if (id.includes('4-32k')) {
      return { contextWindow: 32768, maxOutput: 4096 }
    }
    
    // GPT-4 base
    if (id.includes('gpt-4')) {
      return { contextWindow: 8192, maxOutput: 4096 }
    }
    
    // GPT-3.5
    if (id.includes('3.5')) {
      return { contextWindow: 16385, maxOutput: 4096 }
    }
    
    // Fallback
    return { contextWindow: 8192, maxOutput: 4096 }
  }

  /**
   * Formata o nome do modelo para exibição
   */
  private formatModelName(modelId: string): string {
    return modelId
      .replace('gpt-', 'GPT-')
      .replace('-turbo', ' Turbo')
      .replace('-preview', ' Preview')
      .replace('-mini', ' Mini')
      .replace('chatgpt-', 'ChatGPT-')
      .replace(/(\d{4})-(\d{2})-(\d{2})/, '($1-$2-$3)')
  }

  /**
   * Estima o número de tokens em um texto
   * Usa aproximação de ~4 caracteres por token para inglês
   * Para português/outros idiomas, usa ~3 caracteres por token
   */
  estimateTokens(text: string): number {
    // Detectar se é majoritariamente ASCII (inglês) ou não
    const asciiChars = text.replace(/[^\x00-\x7F]/g, '').length
    const totalChars = text.length
    const asciiRatio = asciiChars / totalChars

    // Usar ratio diferente baseado no idioma
    const charsPerToken = asciiRatio > 0.8 ? 4 : 3
    
    return Math.ceil(text.length / charsPerToken)
  }

  /**
   * Estima tokens de uma lista de mensagens
   */
  estimateMessagesTokens(messages: AIMessage[]): number {
    let totalTokens = 0
    
    for (const msg of messages) {
      // Overhead por mensagem (~4 tokens para role, separadores, etc)
      totalTokens += 4
      
      // Conteúdo da mensagem
      totalTokens += this.estimateTokens(msg.content)
      
      // Se o conteúdo contém base64 de imagem, adicionar tokens extras
      if (msg.content.includes('data:image')) {
        totalTokens += 170 // Imagens consomem ~85-170 tokens
      }
    }
    
    // Overhead do sistema (~3 tokens)
    totalTokens += 3
    
    return totalTokens
  }

  /**
   * Prompt padrão para condensamento inteligente de contexto
   */
  static readonly CONDENSE_SYSTEM_PROMPT = `Você é um especialista em resumir conversas mantendo o contexto essencial para continuidade fluida.

OBJETIVO: Criar um resumo que permita ao assistente continuar a conversa naturalmente, como se tivesse acesso ao histórico completo.

REGRAS DE CONDENSAMENTO:
1. **Contexto do Usuário**: Capture quem é o usuário, suas preferências, estilo de comunicação
2. **Tópicos Discutidos**: Liste os principais assuntos abordados
3. **Decisões Tomadas**: Registre qualquer decisão ou conclusão importante
4. **Tarefas Pendentes**: Anote tarefas mencionadas mas não concluídas
5. **Informações Técnicas**: Preserve detalhes técnicos relevantes (código, configurações, etc)
6. **Tom da Conversa**: Indique se é formal, casual, técnico, etc

FORMATO DO RESUMO:
📋 **Contexto Geral**: [Breve descrição do contexto]
👤 **Sobre o Usuário**: [Preferências e estilo identificados]
📝 **Tópicos Principais**:
- [Tópico 1]
- [Tópico 2]
✅ **Decisões/Conclusões**:
- [Decisão 1]
⏳ **Pendências**:
- [Tarefa pendente]
💡 **Notas Importantes**: [Detalhes técnicos ou contextuais relevantes]

IMPORTANTE: O resumo deve ser conciso mas completo o suficiente para que a conversa continue sem perda de contexto.`

  /**
   * Condensa mensagens antigas em um resumo para economizar contexto
   */
  async condenseMessages(
    messages: AIMessage[],
    maxTokens: number = 2000
  ): Promise<{ summary: string; condensedMessages: AIMessage[]; usage?: TokenUsage }> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized')
    }

    // Separar mensagens recentes (manter intactas) das antigas (condensar)
    const recentCount = Math.min(4, Math.floor(messages.length / 2))
    const recentMessages = messages.slice(-recentCount)
    const oldMessages = messages.slice(0, -recentCount)

    if (oldMessages.length === 0) {
      return {
        summary: '',
        condensedMessages: messages
      }
    }

    // Criar texto das mensagens antigas para resumir
    const oldConversation = oldMessages
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
      .join('\n\n')

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini', // Usar modelo mais barato mas capaz para resumo
        messages: [
          {
            role: 'system',
            content: OpenAIService.CONDENSE_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `Resuma a seguinte conversa (${oldMessages.length} mensagens) para permitir continuidade fluida:\n\n${oldConversation}`
          }
        ],
        temperature: 0.3,
        max_tokens: maxTokens
      })

      const summary = response.choices[0]?.message?.content || ''
      
      // Capturar uso de tokens
      const usage: TokenUsage | undefined = response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined

      // Criar mensagem de sistema com o resumo
      const summaryMessage: AIMessage = {
        role: 'system',
        content: `[📚 Contexto Condensado - ${oldMessages.length} mensagens resumidas]\n\n${summary}\n\n[Fim do resumo - Continue a conversa naturalmente]`
      }

      console.log(`[OpenAI] Condensamento: ${oldMessages.length} mensagens → resumo de ${summary.length} chars`)
      if (usage) {
        console.log(`[OpenAI] Tokens usados no condensamento: ${usage.totalTokens}`)
      }

      return {
        summary,
        condensedMessages: [summaryMessage, ...recentMessages],
        usage
      }
    } catch (error) {
      console.error('[OpenAI] Error condensing messages:', error)
      // Em caso de erro, retornar mensagens originais
      return {
        summary: '',
        condensedMessages: messages
      }
    }
  }
}
