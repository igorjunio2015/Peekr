import { app, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { AIMessage } from '../shared/types'

export interface ExportOptions {
  format: 'txt' | 'json' | 'markdown' | 'csv'
  includeTimestamps?: boolean
  includeMetadata?: boolean
}

export class ExportService {
  static getDocumentsPath(): string {
    return path.join(app.getPath('documents'), 'AI-Overlay-Agent')
  }

  static ensureDirectoryExists(): void {
    const dir = this.getDocumentsPath()
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  static generateFilename(title: string, format: string): string {
    const timestamp = new Date().toISOString().split('T')[0]
    const sanitized = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 30)
    return `${timestamp}_${sanitized}.${format}`
  }

  static async exportConversation(
    messages: AIMessage[],
    title: string,
    options: ExportOptions = { format: 'markdown' }
  ): Promise<string> {
    this.ensureDirectoryExists()

    const filename = this.generateFilename(title, options.format)
    const filepath = path.join(this.getDocumentsPath(), filename)

    let content = ''

    switch (options.format) {
      case 'txt':
        content = this.formatAsText(messages, title, options)
        break
      case 'json':
        content = this.formatAsJSON(messages, title, options)
        break
      case 'markdown':
        content = this.formatAsMarkdown(messages, title, options)
        break
      case 'csv':
        content = this.formatAsCSV(messages, title, options)
        break
    }

    fs.writeFileSync(filepath, content, 'utf-8')
    return filepath
  }

  private static formatAsText(
    messages: AIMessage[],
    title: string,
    options: ExportOptions
  ): string {
    let text = `${title}\n`
    text += `${'='.repeat(title.length)}\n\n`

    if (options.includeMetadata) {
      text += `Exported: ${new Date().toLocaleString()}\n`
      text += `Total Messages: ${messages.length}\n\n`
    }

    messages.forEach((msg) => {
      text += `[${msg.role.toUpperCase()}]\n`
      text += `${msg.content}\n\n`
    })

    return text
  }

  private static formatAsMarkdown(
    messages: AIMessage[],
    title: string,
    options: ExportOptions
  ): string {
    let md = `# ${title}\n\n`

    if (options.includeMetadata) {
      md += `> Exported: ${new Date().toLocaleString()}\n`
      md += `> Total Messages: ${messages.length}\n\n`
    }

    messages.forEach((msg) => {
      const role = msg.role === 'assistant' ? '🤖' : '👤'
      md += `${role} **${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}**\n\n`
      md += `${msg.content}\n\n`
      md += '---\n\n'
    })

    return md
  }

  private static formatAsJSON(
    messages: AIMessage[],
    title: string,
    _options: ExportOptions
  ): string {
    const data = {
      title,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages,
    }

    return JSON.stringify(data, null, 2)
  }

  private static formatAsCSV(
    messages: AIMessage[],
    _title: string,
    _options: ExportOptions
  ): string {
    let csv = 'Role,Message\n'

    messages.forEach((msg) => {
      const content = msg.content.replace(/"/g, '""')
      csv += `"${msg.role}","${content}"\n`
    })

    return csv
  }

  static async openExportFolder(): Promise<void> {
    const { shell } = require('electron')
    const dir = this.getDocumentsPath()
    this.ensureDirectoryExists()
    shell.openPath(dir)
  }

  static async selectExportLocation(format: string): Promise<string | null> {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(
        app.getPath('documents'),
        `conversation_${Date.now()}.${format}`
      ),
      filters: [
        {
          name: format.toUpperCase(),
          extensions: [format],
        },
        {
          name: 'All Files',
          extensions: ['*'],
        },
      ],
    })

    return result.canceled ? null : result.filePath
  }
}
