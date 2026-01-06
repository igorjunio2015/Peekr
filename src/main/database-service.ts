/**
 * Database Service - SQLite usando sql.js (WebAssembly)
 * Persistência de conversas, mensagens e configurações
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

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
  metadata?: MessageMetadata // Metadados opcionais
}

export class DatabaseService {
  private db: SqlJsDatabase | null = null
  private dbPath: string
  private initialized = false

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'ai-overlay.db')
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const SQL = await initSqlJs()
      
      // Tentar carregar banco existente
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath)
        this.db = new SQL.Database(fileBuffer)
      } else {
        this.db = new SQL.Database()
      }

      this.createTables()
      this.initialized = true
      console.log('Database initialized at:', this.dbPath)
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  }

  private createTables(): void {
    if (!this.db) return

    // Tabela de conversas
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Tabela de mensagens (com coluna metadata para JSON)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `)

    // Tabela de configurações
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // Índices
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)`)

    // Migração: adicionar coluna metadata se não existir
    this.migrateAddMetadataColumn()

    this.saveToFile()
  }

  private migrateAddMetadataColumn(): void {
    if (!this.db) return
    
    try {
      // Verificar se a coluna metadata já existe
      const tableInfo = this.db.exec(`PRAGMA table_info(messages)`)
      const columns = tableInfo[0]?.values || []
      const hasMetadata = columns.some((col: any) => col[1] === 'metadata')
      
      if (!hasMetadata) {
        console.log('Migrating: Adding metadata column to messages table')
        this.db.run(`ALTER TABLE messages ADD COLUMN metadata TEXT`)
      }
    } catch (error) {
      console.error('Migration error:', error)
    }
  }

  private saveToFile(): void {
    if (!this.db) return
    try {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      fs.writeFileSync(this.dbPath, buffer)
    } catch (error) {
      console.error('Failed to save database:', error)
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // ==================== CONVERSATIONS ====================

  getAllConversations(): Conversation[] {
    if (!this.db) return []
    
    const stmt = this.db.prepare(`
      SELECT id, title, created_at, updated_at 
      FROM conversations 
      ORDER BY updated_at DESC
    `)
    
    const conversations: Conversation[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as any
      conversations.push({
        id: row.id,
        title: row.title,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })
    }
    stmt.free()
    
    return conversations
  }

  getConversation(id: string): Conversation | undefined {
    if (!this.db) return undefined
    
    const stmt = this.db.prepare(`
      SELECT id, title, created_at, updated_at 
      FROM conversations 
      WHERE id = ?
    `)
    stmt.bind([id])
    
    if (stmt.step()) {
      const row = stmt.getAsObject() as any
      stmt.free()
      return {
        id: row.id,
        title: row.title,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    }
    stmt.free()
    return undefined
  }

  createConversation(title: string): Conversation {
    if (!this.db) throw new Error('Database not initialized')
    
    const id = this.generateId()
    const now = Date.now()
    
    this.db.run(`
      INSERT INTO conversations (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `, [id, title, now, now])
    
    this.saveToFile()
    
    return { id, title, created_at: now, updated_at: now }
  }

  updateConversation(id: string, updates: { title?: string }): boolean {
    if (!this.db) return false
    
    const now = Date.now()
    
    if (updates.title !== undefined) {
      this.db.run(`
        UPDATE conversations 
        SET title = ?, updated_at = ?
        WHERE id = ?
      `, [updates.title, now, id])
    }
    
    this.saveToFile()
    return true
  }

  deleteConversation(id: string): boolean {
    if (!this.db) return false
    
    // Deletar mensagens primeiro
    this.db.run(`DELETE FROM messages WHERE conversation_id = ?`, [id])
    this.db.run(`DELETE FROM conversations WHERE id = ?`, [id])
    
    this.saveToFile()
    return true
  }

  // ==================== MESSAGES ====================

  getMessages(conversationId: string): Message[] {
    if (!this.db) return []
    
    const stmt = this.db.prepare(`
      SELECT id, conversation_id, role, content, created_at, metadata
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `)
    stmt.bind([conversationId])
    
    const messages: Message[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as any
      const message: Message = {
        id: row.id,
        conversation_id: row.conversation_id,
        role: row.role as Message['role'],
        content: row.content,
        created_at: row.created_at,
      }
      
      // Parse metadata JSON se existir
      if (row.metadata) {
        try {
          message.metadata = JSON.parse(row.metadata)
        } catch (e) {
          console.error('Failed to parse message metadata:', e)
        }
      }
      
      messages.push(message)
    }
    stmt.free()
    
    return messages
  }

  addMessage(conversationId: string, role: Message['role'], content: string, metadata?: MessageMetadata): Message {
    if (!this.db) throw new Error('Database not initialized')
    
    const id = this.generateId()
    const now = Date.now()
    const metadataJson = metadata ? JSON.stringify(metadata) : null
    
    this.db.run(`
      INSERT INTO messages (id, conversation_id, role, content, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, conversationId, role, content, now, metadataJson])
    
    // Atualizar timestamp da conversa
    this.db.run(`
      UPDATE conversations SET updated_at = ? WHERE id = ?
    `, [now, conversationId])
    
    this.saveToFile()
    
    return { id, conversation_id: conversationId, role, content, created_at: now, metadata }
  }

  updateMessageMetadata(messageId: string, metadata: MessageMetadata): boolean {
    if (!this.db) return false
    
    const metadataJson = JSON.stringify(metadata)
    this.db.run(`UPDATE messages SET metadata = ? WHERE id = ?`, [metadataJson, messageId])
    this.saveToFile()
    return true
  }

  deleteMessage(id: string): boolean {
    if (!this.db) return false
    
    this.db.run(`DELETE FROM messages WHERE id = ?`, [id])
    this.saveToFile()
    return true
  }

  // ==================== SETTINGS ====================

  getSetting(key: string): string | null {
    if (!this.db) return null
    
    const stmt = this.db.prepare(`SELECT value FROM settings WHERE key = ?`)
    stmt.bind([key])
    
    if (stmt.step()) {
      const row = stmt.getAsObject() as any
      stmt.free()
      return row.value
    }
    stmt.free()
    return null
  }

  getAllSettings(): Record<string, string> {
    if (!this.db) return {}
    
    const stmt = this.db.prepare(`SELECT key, value FROM settings`)
    const settings: Record<string, string> = {}
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as any
      settings[row.key] = row.value
    }
    stmt.free()
    
    return settings
  }

  setSetting(key: string, value: string): boolean {
    if (!this.db) return false
    
    this.db.run(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `, [key, value])
    
    this.saveToFile()
    return true
  }

  // ==================== CLEANUP ====================

  close(): void {
    if (this.db) {
      this.saveToFile()
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }
}

// Singleton
export const databaseService = new DatabaseService()
