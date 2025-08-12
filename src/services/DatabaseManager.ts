import Database from 'better-sqlite3'
import { Conversation, Message, AIParticipant } from '../types/index.js'
import { config } from '../config/index.js'
import * as path from 'path'
import * as fs from 'fs'

export class DatabaseManager {
  private db: Database.Database

  constructor() {
    // 从配置获取数据库路径
    const dbUrl = config.database.url
    let dbPath: string

    if (dbUrl.startsWith('sqlite://')) {
      dbPath = dbUrl.replace('sqlite://', '')
    } else {
      dbPath = './data/brainstorm.db'
    }

    // 确保数据目录存在
    const dataDir = path.dirname(dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    this.db = new Database(dbPath)
    this.initializeTables()
  }

  private initializeTables(): void {
    // 创建conversations表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_round INTEGER DEFAULT 0,
        max_rounds INTEGER DEFAULT 1,
        participants TEXT NOT NULL, -- JSON string
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        tags TEXT -- JSON array
      )
    `)

    // 创建messages表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT, -- JSON string
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
      )
    `)

    // 创建索引以提高查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations (client_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations (updated_at);
    `)
  }

  saveConversation(conversation: Conversation, clientId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversations 
      (id, client_id, title, status, current_round, max_rounds, participants, created_at, updated_at, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      conversation.id,
      clientId,
      conversation.title,
      conversation.status,
      conversation.currentRound,
      conversation.maxRounds,
      JSON.stringify(conversation.participants),
      conversation.createdAt.toISOString(),
      conversation.updatedAt.toISOString(),
      JSON.stringify(conversation.tags || [])
    )
  }

  getConversation(clientId: string, conversationId: string): Conversation | null {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND client_id = ?
    `)
    const row = stmt.get(conversationId, clientId) as any

    if (!row) return null

    // 获取消息
    const messages = this.getMessages(conversationId)

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      currentRound: row.current_round,
      maxRounds: row.max_rounds,
      participants: JSON.parse(row.participants),
      messages,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      tags: JSON.parse(row.tags || '[]')
    }
  }

  getAllConversations(clientId: string): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations WHERE client_id = ? ORDER BY updated_at DESC
    `)
    const rows = stmt.all(clientId) as any[]

    return rows.map(row => {
      const messages = this.getMessages(row.id)
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        currentRound: row.current_round,
        maxRounds: row.max_rounds,
        participants: JSON.parse(row.participants),
        messages,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        tags: JSON.parse(row.tags || '[]')
      }
    })
  }

  saveMessage(message: Message, conversationId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages 
      (id, conversation_id, role, content, model, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      message.id,
      conversationId,
      message.role,
      message.content,
      message.model || null,
      message.timestamp.toISOString(),
      JSON.stringify(message.metadata || {})
    )
  }

  getMessages(conversationId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
    `)
    const rows = stmt.all(conversationId) as any[]

    return rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      model: row.model,
      timestamp: new Date(row.timestamp),
      metadata: JSON.parse(row.metadata || '{}')
    }))
  }

  updateConversationStatus(conversationId: string, clientId: string, status: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET status = ?, updated_at = ? 
      WHERE id = ? AND client_id = ?
    `)
    stmt.run(status, new Date().toISOString(), conversationId, clientId)
  }

  deleteConversation(conversationId: string, clientId: string): void {
    // 由于有外键约束和CASCADE，删除conversation会自动删除相关的messages
    const stmt = this.db.prepare(`
      DELETE FROM conversations WHERE id = ? AND client_id = ?
    `)
    stmt.run(conversationId, clientId)
  }

  close(): void {
    this.db.close()
  }

  // 清理旧数据（可选功能）
  cleanupOldConversations(daysOld: number = 30): number {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    
    const stmt = this.db.prepare(`
      DELETE FROM conversations WHERE updated_at < ?
    `)
    const result = stmt.run(cutoffDate.toISOString())
    return result.changes
  }
}