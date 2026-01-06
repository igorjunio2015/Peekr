import { useState, useCallback, useEffect, useRef } from 'react'

export interface Conversation {
  id: string
  title: string
  created_at: number
  updated_at: number
}

export interface MessageMetadata {
  tokens?: number           // Tokens usados nesta mensagem
  promptTokens?: number     // Tokens de entrada (para respostas da IA)
  completionTokens?: number // Tokens de saída (para respostas da IA)
  cost?: number             // Custo em USD
  model?: string            // Modelo usado
  audioDuration?: number    // Duração do áudio em segundos (se aplicável)
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: number
  metadata?: MessageMetadata
}

export interface Settings {
  system_prompt: string
  model: string
  language: string
  api_key: string
  [key: string]: string
}

export const useDatabase = () => {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Carregar conversas iniciais
  const loadConversations = useCallback(async () => {
    if (!window.electronAPI?.dbGetConversations) return
    
    try {
      const convs = await window.electronAPI.dbGetConversations()
      setConversations(convs)
      
      // Selecionar primeira conversa se existir
      if (convs.length > 0 && !currentConversationId) {
        setCurrentConversationId(convs[0].id)
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error)
    }
  }, [currentConversationId])

  // Carregar mensagens da conversa atual
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!window.electronAPI?.dbGetMessages) return
    
    try {
      const msgs = await window.electronAPI.dbGetMessages(conversationId)
      setMessages(msgs)
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
    }
  }, [])

  // Carregar configurações
  const loadSettings = useCallback(async () => {
    if (!window.electronAPI?.dbGetAllSettings) return
    
    try {
      const allSettings = await window.electronAPI.dbGetAllSettings()
      setSettings(allSettings as Settings)
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }, [])

  // Inicialização
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await loadConversations()
      await loadSettings()
      setIsLoading(false)
    }
    init()
  }, [loadConversations, loadSettings])

  // Carregar mensagens quando conversa mudar
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId)
    } else {
      setMessages([])
    }
  }, [currentConversationId, loadMessages])

  // ==================== CONVERSATIONS ====================

  const createConversation = useCallback(async (title: string): Promise<Conversation | null> => {
    if (!window.electronAPI?.dbCreateConversation) return null
    
    try {
      const conv = await window.electronAPI.dbCreateConversation(title)
      setConversations(prev => [conv, ...prev])
      setCurrentConversationId(conv.id)
      setMessages([])
      return conv
    } catch (error) {
      console.error('Erro ao criar conversa:', error)
      return null
    }
  }, [])

  const updateConversation = useCallback(async (id: string, updates: { title?: string }) => {
    if (!window.electronAPI?.dbUpdateConversation) return
    
    try {
      await window.electronAPI.dbUpdateConversation(id, updates)
      setConversations(prev => 
        prev.map(c => c.id === id ? { ...c, ...updates, updated_at: Date.now() } : c)
      )
    } catch (error) {
      console.error('Erro ao atualizar conversa:', error)
    }
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    if (!window.electronAPI?.dbDeleteConversation) return
    
    try {
      await window.electronAPI.dbDeleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      
      if (currentConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id)
        setCurrentConversationId(remaining.length > 0 ? remaining[0].id : null)
      }
    } catch (error) {
      console.error('Erro ao deletar conversa:', error)
    }
  }, [currentConversationId, conversations])

  // ==================== MESSAGES ====================

  // Ref para manter o ID da conversa atual sempre atualizado (evita problemas de closure)
  const currentConversationIdRef = useRef<string | null>(currentConversationId)
  
  // Atualizar ref quando o estado mudar
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId
  }, [currentConversationId])

  const addMessage = useCallback(async (
    role: Message['role'],
    content: string,
    forceConversationId?: string,
    metadata?: MessageMetadata
  ): Promise<Message | null> => {
    if (!window.electronAPI?.dbAddMessage) return null
    
    // Usar ID forçado, ou ref (mais atual que o estado), ou estado
    let convId = forceConversationId || currentConversationIdRef.current || currentConversationId
    
    if (!convId) {
      // Criar nova conversa se não existir
      const newConv = await createConversation(content.substring(0, 30) || 'Nova Conversa')
      if (!newConv) return null
      convId = newConv.id
      // Atualizar ref imediatamente para próximas chamadas
      currentConversationIdRef.current = convId
    }
    
    try {
      const msg = await window.electronAPI.dbAddMessage(convId, role, content, metadata)
      // Adicionar conversation_id à mensagem retornada para uso posterior
      const msgWithConvId = { ...msg, conversation_id: convId, metadata }
      setMessages(prev => [...prev, msgWithConvId])
      
      // Atualizar timestamp da conversa na lista
      setConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, updated_at: Date.now() } : c)
          .sort((a, b) => b.updated_at - a.updated_at)
      )
      
      return msgWithConvId
    } catch (error) {
      console.error('Erro ao adicionar mensagem:', error)
      return null
    }
  }, [currentConversationId, createConversation])

  const updateMessageMetadata = useCallback(async (messageId: string, metadata: MessageMetadata): Promise<boolean> => {
    if (!window.electronAPI?.dbUpdateMessageMetadata) return false
    
    try {
      await window.electronAPI.dbUpdateMessageMetadata(messageId, metadata)
      // Atualizar mensagem no estado local
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, metadata } : m)
      )
      return true
    } catch (error) {
      console.error('Erro ao atualizar metadados da mensagem:', error)
      return false
    }
  }, [])

  const deleteMessage = useCallback(async (id: string) => {
    if (!window.electronAPI?.dbDeleteMessage) return
    
    try {
      await window.electronAPI.dbDeleteMessage(id)
      setMessages(prev => prev.filter(m => m.id !== id))
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error)
    }
  }, [])

  // ==================== SETTINGS ====================

  const getSetting = useCallback(async (key: string): Promise<string | null> => {
    if (!window.electronAPI?.dbGetSetting) return null
    
    try {
      return await window.electronAPI.dbGetSetting(key)
    } catch (error) {
      console.error('Erro ao obter configuração:', error)
      return null
    }
  }, [])

  const setSetting = useCallback(async (key: string, value: string) => {
    if (!window.electronAPI?.dbSetSetting) return
    
    try {
      await window.electronAPI.dbSetSetting(key, value)
      setSettings(prev => prev ? { ...prev, [key]: value } : null)
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
    }
  }, [])

  // ==================== HELPERS ====================

  const getCurrentConversation = useCallback((): Conversation | undefined => {
    return conversations.find(c => c.id === currentConversationId)
  }, [conversations, currentConversationId])

  return {
    // State
    conversations,
    currentConversationId,
    messages,
    settings,
    isLoading,
    
    // Conversation actions
    setCurrentConversationId,
    createConversation,
    updateConversation,
    deleteConversation,
    getCurrentConversation,
    
    // Message actions
    addMessage,
    deleteMessage,
    updateMessageMetadata,
    
    // Settings actions
    getSetting,
    setSetting,
    
    // Refresh
    loadConversations,
    loadSettings,
  }
}
