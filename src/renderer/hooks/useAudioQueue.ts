/**
 * Hook para gerenciar fila de processamento de áudio
 * Permite que múltiplas transcrições sejam processadas sem parar a gravação
 */

import { useState, useRef, useCallback } from 'react'

interface QueueItem {
  id: string
  blob: Blob
  language: string
  timestamp: number
}

interface UseAudioQueueOptions {
  onProcess: (blob: Blob, language: string) => Promise<void>
}

export const useAudioQueue = (options: UseAudioQueueOptions) => {
  const { onProcess } = options
  
  const [queueSize, setQueueSize] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const queueRef = useRef<QueueItem[]>([])
  const processingRef = useRef<boolean>(false)
  
  // Adicionar item à fila
  const enqueue = useCallback((blob: Blob, language: string) => {
    const item: QueueItem = {
      id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      blob,
      language,
      timestamp: Date.now()
    }
    
    queueRef.current.push(item)
    setQueueSize(queueRef.current.length)
    
    console.log(`[Queue] ➕ Item adicionado à fila (${queueRef.current.length} itens)`)
    
    // Processar fila se não estiver processando
    if (!processingRef.current) {
      processQueue()
    }
  }, [])
  
  // Processar fila sequencialmente
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return
    
    processingRef.current = true
    setIsProcessing(true)
    
    console.log(`[Queue] 🔄 Iniciando processamento da fila (${queueRef.current.length} itens)`)
    
    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()
      if (!item) break
      
      setQueueSize(queueRef.current.length)
      
      console.log(`[Queue] 📤 Processando item ${item.id} (${queueRef.current.length} restantes)`)
      
      try {
        await onProcess(item.blob, item.language)
        console.log(`[Queue] ✅ Item ${item.id} processado com sucesso`)
      } catch (error) {
        console.error(`[Queue] ❌ Erro ao processar item ${item.id}:`, error)
        // Continuar processando mesmo com erro
      }
    }
    
    processingRef.current = false
    setIsProcessing(false)
    setQueueSize(0)
    
    console.log('[Queue] 🏁 Fila processada completamente')
  }, [onProcess])
  
  // Limpar fila
  const clearQueue = useCallback(() => {
    queueRef.current = []
    setQueueSize(0)
    console.log('[Queue] 🗑️ Fila limpa')
  }, [])
  
  return {
    enqueue,
    queueSize,
    isProcessing,
    clearQueue
  }
}