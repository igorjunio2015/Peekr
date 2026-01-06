import { useState, useCallback } from 'react'
import { AIMessage } from '@shared/types'

export interface ExportOptions {
  format: 'txt' | 'json' | 'markdown' | 'csv'
  includeTimestamps?: boolean
  includeMetadata?: boolean
}

export const useExport = () => {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportConversation = useCallback(
    async (
      messages: AIMessage[],
      title: string,
      options: ExportOptions = { format: 'markdown' }
    ): Promise<string | null> => {
      setIsExporting(true)
      setError(null)

      try {
        const result = await window.electronAPI?.exportConversation?.(
          messages,
          title,
          options
        )

        setIsExporting(false)
        return result || null
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Export failed'
        setError(errorMessage)
        setIsExporting(false)
        return null
      }
    },
    []
  )

  const downloadAsFile = useCallback((content: string, filename: string, format: string) => {
    const element = document.createElement('a')
    const file = new Blob([content], { type: `text/${format}` })
    element.href = URL.createObjectURL(file)
    element.download = filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }, [])

  const exportAsText = useCallback(
    (messages: AIMessage[], title: string): string => {
      let text = `${title}\n`
      text += `${'='.repeat(title.length)}\n\n`
      text += `Exported: ${new Date().toLocaleString()}\n`
      text += `Total Messages: ${messages.length}\n\n`

      messages.forEach((msg) => {
        text += `[${msg.role.toUpperCase()}]\n`
        text += `${msg.content}\n\n`
      })

      return text
    },
    []
  )

  const exportAsMarkdown = useCallback(
    (messages: AIMessage[], title: string): string => {
      let md = `# ${title}\n\n`
      md += `> Exported: ${new Date().toLocaleString()}\n`
      md += `> Total Messages: ${messages.length}\n\n`

      messages.forEach((msg) => {
        const role = msg.role === 'assistant' ? '🤖' : '👤'
        md += `${role} **${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}**\n\n`
        
        // Processar conteúdo para extrair imagens e áudios
        let content = msg.content
        
        // Verificar se contém imagem [IMG:base64data]
        const imgMatch = content.match(/\[IMG:([^\]]+)\]/)
        if (imgMatch) {
          const imageData = imgMatch[1]
          content = content.replace(/\[IMG:[^\]]+\]\n?/, '')
          md += `📷 **Screenshot Capturado**\n\n`
          md += `![Screenshot](data:image/jpeg;base64,${imageData})\n\n`
        }
        
        // Verificar se contém áudio [AUDIO:audioUrl]
        const audioMatch = content.match(/\[AUDIO:([^\]]+)\]/)
        if (audioMatch) {
          const audioUrl = audioMatch[1]
          content = content.replace(/\[AUDIO:[^\]]+\]\n?/, '')
          md += `🎵 **Áudio Capturado**\n\n`
          md += `[Clique para ouvir o áudio](${audioUrl})\n\n`
        }
        
        // Remover marcadores de texto como [Áudio do Sistema] ou [Screenshot capturado]
        content = content.replace(/\[Áudio do Sistema\]\n?/g, '')
        content = content.replace(/\[Screenshot capturado\][^\n]*\n?/g, '')
        
        if (content.trim()) {
          md += `${content.trim()}\n\n`
        }
        
        md += '---\n\n'
      })

      return md
    },
    []
  )

  const exportAsJSON = useCallback(
    (messages: AIMessage[], title: string): string => {
      const data = {
        title,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages,
      }

      return JSON.stringify(data, null, 2)
    },
    []
  )

  const exportAsCSV = useCallback(
    (messages: AIMessage[], _title: string): string => {
      let csv = 'Role,Message\n'

      messages.forEach((msg) => {
        const content = msg.content.replace(/"/g, '""')
        csv += `"${msg.role}","${content}"\n`
      })

      return csv
    },
    []
  )

  return {
    exportConversation,
    downloadAsFile,
    exportAsText,
    exportAsMarkdown,
    exportAsJSON,
    exportAsCSV,
    isExporting,
    error,
  }
}
