import React, { useState } from 'react'
import { AIMessage } from '@shared/types'
import { useExport } from '../hooks/useExport'
import { useTranslation } from '../hooks/useTranslation'

interface OverlayMenuProps {
  messages: AIMessage[]
  conversationTitle: string
  apiKey: string
  onClose: () => void
}

export const OverlayMenu: React.FC<OverlayMenuProps> = ({
  messages,
  conversationTitle,
  apiKey,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'txt' | 'json' | 'markdown' | 'csv'>(
    'markdown'
  )
  const [translateTarget, setTranslateTarget] = useState('Portuguese')
  const [selectedMessage, setSelectedMessage] = useState<AIMessage | null>(null)

  const { exportAsText, exportAsMarkdown, exportAsJSON, exportAsCSV, downloadAsFile } =
    useExport()
  const { translateText, isTranslating } = useTranslation(apiKey)

  const handleExport = () => {
    let content = ''

    switch (selectedFormat) {
      case 'txt':
        content = exportAsText(messages, conversationTitle)
        break
      case 'markdown':
        content = exportAsMarkdown(messages, conversationTitle)
        break
      case 'json':
        content = exportAsJSON(messages, conversationTitle)
        break
      case 'csv':
        content = exportAsCSV(messages, conversationTitle)
        break
    }

    const filename = `${conversationTitle}_${Date.now()}.${selectedFormat}`
    downloadAsFile(content, filename, selectedFormat)
    onClose()
  }

  const handleTranslateMessage = async () => {
    if (!selectedMessage) return

    const translation = await translateText(selectedMessage.content, translateTarget)
    if (translation) {
      downloadAsFile(
        translation,
        `translation_${Date.now()}.txt`,
        'txt'
      )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto">
      <div className="bg-gray-900 border border-cyan-500/30 rounded-lg p-6 w-96 shadow-2xl max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-cyan-400 font-bold text-lg">Menu</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Export Section */}
        <div className="mb-6">
          <h4 className="text-cyan-300 font-semibold text-sm mb-3">Export Conversation</h4>

          <div className="space-y-2 mb-3">
            <label className="text-xs text-gray-400">Format:</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as any)}
              className="w-full bg-gray-800 border border-cyan-500/20 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="markdown">Markdown</option>
              <option value="txt">Text</option>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            className="w-full bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 rounded px-3 py-2 border border-cyan-500/30 text-xs font-semibold transition-colors"
          >
            Download Export
          </button>
        </div>

        {/* Translation Section */}
        <div className="mb-6 border-t border-cyan-500/20 pt-4">
          <h4 className="text-cyan-300 font-semibold text-sm mb-3">Translate Message</h4>

          <div className="space-y-2 mb-3">
            <label className="text-xs text-gray-400">Select Message:</label>
            <select
              value={selectedMessage ? messages.indexOf(selectedMessage) : -1}
              onChange={(e) => {
                const idx = parseInt(e.target.value)
                setSelectedMessage(idx >= 0 ? messages[idx] : null)
              }}
              className="w-full bg-gray-800 border border-cyan-500/20 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value={-1}>Choose a message...</option>
              {messages.map((msg, idx) => (
                <option key={idx} value={idx}>
                  {msg.role}: {msg.content.substring(0, 30)}...
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 mb-3">
            <label className="text-xs text-gray-400">Target Language:</label>
            <input
              type="text"
              value={translateTarget}
              onChange={(e) => setTranslateTarget(e.target.value)}
              placeholder="e.g., Spanish, French"
              className="w-full bg-gray-800 border border-cyan-500/20 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <button
            onClick={handleTranslateMessage}
            disabled={!selectedMessage || isTranslating}
            className="w-full bg-cyan-600/30 hover:bg-cyan-600/50 disabled:opacity-50 text-cyan-300 rounded px-3 py-2 border border-cyan-500/30 text-xs font-semibold transition-colors"
          >
            {isTranslating ? 'Translating...' : 'Translate'}
          </button>
        </div>

        {/* Stats */}
        <div className="border-t border-cyan-500/20 pt-4 text-xs text-gray-400">
          <p>Total Messages: {messages.length}</p>
          <p>Conversation: {conversationTitle}</p>
        </div>
      </div>
    </div>
  )
}
