import { useState, useCallback, useEffect } from 'react'
import { AIMessage } from '@shared/types'

const STORAGE_KEY = 'ai_overlay_conversations'
const MAX_HISTORY_ITEMS = 50

export interface Conversation {
  id: string
  title: string
  messages: AIMessage[]
  createdAt: number
  updatedAt: number
}

export const useConversationHistory = () => {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setConversations(parsed)
        if (parsed.length > 0) {
          setCurrentConversationId(parsed[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }, [])

  const saveConversations = useCallback((convos: Conversation[]) => {
    try {
      const toSave = convos.slice(0, MAX_HISTORY_ITEMS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
      setConversations(toSave)
    } catch (error) {
      console.error('Failed to save conversations:', error)
    }
  }, [])

  const createConversation = useCallback((title: string = 'New Conversation'): string => {
    const id = Date.now().toString()
    const newConversation: Conversation = {
      id,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const updated = [newConversation, ...conversations]
    saveConversations(updated)
    setCurrentConversationId(id)
    return id
  }, [conversations, saveConversations])

  const addMessage = useCallback(
    (message: AIMessage, conversationId?: string) => {
      const targetId = conversationId || currentConversationId
      if (!targetId) return

      const updated = conversations.map((conv) => {
        if (conv.id === targetId) {
          return {
            ...conv,
            messages: [...conv.messages, message],
            updatedAt: Date.now(),
          }
        }
        return conv
      })

      saveConversations(updated)
    },
    [conversations, currentConversationId, saveConversations]
  )

  const getCurrentConversation = useCallback((): Conversation | undefined => {
    return conversations.find((conv) => conv.id === currentConversationId)
  }, [conversations, currentConversationId])

  const deleteConversation = useCallback(
    (conversationId: string) => {
      const updated = conversations.filter((conv) => conv.id !== conversationId)
      saveConversations(updated)

      if (currentConversationId === conversationId) {
        setCurrentConversationId(updated.length > 0 ? updated[0].id : null)
      }
    },
    [conversations, currentConversationId, saveConversations]
  )

  const clearAllConversations = useCallback(() => {
    saveConversations([])
    setCurrentConversationId(null)
  }, [saveConversations])

  const updateConversationTitle = useCallback(
    (conversationId: string, newTitle: string) => {
      const updated = conversations.map((conv) => {
        if (conv.id === conversationId) {
          return { ...conv, title: newTitle }
        }
        return conv
      })
      saveConversations(updated)
    },
    [conversations, saveConversations]
  )

  return {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    createConversation,
    addMessage,
    getCurrentConversation,
    deleteConversation,
    clearAllConversations,
    updateConversationTitle,
  }
}
