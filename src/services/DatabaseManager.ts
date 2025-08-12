import Database from 'better-sqlite3'
import { Conversation, Message, AIParticipant, KnowledgeEntry } from '../types/index.js'
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
        provider TEXT, -- AI提供商 (如openai, claude, gemini)
        model_id TEXT, -- 具体模型 (如gpt-4, claude-3-5-sonnet)
        timestamp TEXT NOT NULL,
        metadata TEXT, -- JSON string
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
      )
    `)

    // 知识库表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        tags TEXT NOT NULL, -- JSON array
        relevance_score REAL DEFAULT 0.5,
        created_at TEXT NOT NULL
      )
    `)

    // 创建索引以提高查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations (client_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations (updated_at);
      CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON knowledge_entries (topic);
      CREATE INDEX IF NOT EXISTS idx_knowledge_relevance ON knowledge_entries (relevance_score);
      CREATE INDEX IF NOT EXISTS idx_knowledge_created_at ON knowledge_entries (created_at);
    `)

    // 检查是否需要迁移旧的messages表结构
    this.migrateMessagesTable()
  }

  private migrateMessagesTable(): void {
    try {
      // 检查是否存在旧的model列
      const tableInfo = this.db.prepare("PRAGMA table_info(messages)").all() as any[]
      const hasOldModelColumn = tableInfo.some(col => col.name === 'model')
      const hasProviderColumn = tableInfo.some(col => col.name === 'provider')
      const hasModelIdColumn = tableInfo.some(col => col.name === 'model_id')

      if (hasOldModelColumn && !hasProviderColumn && !hasModelIdColumn) {
        console.log('🔄 Migrating messages table structure...')
        
        // 添加新列
        this.db.exec(`ALTER TABLE messages ADD COLUMN provider TEXT`)
        this.db.exec(`ALTER TABLE messages ADD COLUMN model_id TEXT`)
        
        // 迁移数据：将model列的值复制到provider列，并从metadata中提取model_id
        const messages = this.db.prepare('SELECT id, model, metadata FROM messages').all() as any[]
        
        const updateStmt = this.db.prepare(`
          UPDATE messages SET provider = ?, model_id = ? WHERE id = ?
        `)
        
        for (const message of messages) {
          let provider = message.model || 'unknown'
          let modelId = 'unknown-model'
          
          try {
            const metadata = JSON.parse(message.metadata || '{}')
            if (metadata.modelId) {
              modelId = metadata.modelId
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
          
          updateStmt.run(provider, modelId, message.id)
        }
        
        console.log('✅ Messages table migration completed')
      }
    } catch (error) {
      console.warn('⚠️ Messages table migration skipped:', (error as Error).message)
    }
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
      (id, conversation_id, role, content, provider, model_id, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // 从metadata中提取provider和modelId信息
    const provider = message.metadata?.provider || message.model || null
    const modelId = message.metadata?.modelId || null

    stmt.run(
      message.id,
      conversationId,
      message.role,
      message.content,
      provider,
      modelId,
      message.timestamp.toISOString(),
      JSON.stringify(message.metadata || {})
    )
  }

  getMessages(conversationId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
    `)
    const rows = stmt.all(conversationId) as any[]

    return rows.map(row => {
      const metadata = JSON.parse(row.metadata || '{}')
      
      // 确保metadata中包含provider和modelId信息
      if (row.provider && !metadata.provider) {
        metadata.provider = row.provider
      }
      if (row.model_id && !metadata.modelId) {
        metadata.modelId = row.model_id
      }

      return {
        id: row.id,
        role: row.role,
        content: row.content,
        model: row.provider, // 为了向后兼容，保持model字段
        timestamp: new Date(row.timestamp),
        metadata
      }
    })
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

  // === 知识库相关方法 ===

  saveKnowledgeEntry(entry: KnowledgeEntry): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO knowledge_entries 
      (id, topic, content, source, tags, relevance_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      entry.id,
      entry.topic,
      entry.content,
      entry.source,
      JSON.stringify(entry.tags),
      entry.relevanceScore || 0.5,
      entry.createdAt.toISOString()
    )
  }

  getKnowledgeEntriesByTopic(topic: string): KnowledgeEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM knowledge_entries WHERE topic = ? ORDER BY relevance_score DESC
    `)
    const rows = stmt.all(topic) as any[]

    return rows.map(row => ({
      id: row.id,
      topic: row.topic,
      content: row.content,
      source: row.source,
      tags: JSON.parse(row.tags || '[]'),
      relevanceScore: row.relevance_score,
      createdAt: new Date(row.created_at)
    }))
  }

  getAllKnowledgeEntries(): KnowledgeEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM knowledge_entries ORDER BY created_at DESC
    `)
    const rows = stmt.all() as any[]

    return rows.map(row => ({
      id: row.id,
      topic: row.topic,
      content: row.content,
      source: row.source,
      tags: JSON.parse(row.tags || '[]'),
      relevanceScore: row.relevance_score,
      createdAt: new Date(row.created_at)
    }))
  }

  searchKnowledgeEntries(query: string, limit: number = 10): KnowledgeEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM knowledge_entries 
      WHERE topic LIKE ? OR content LIKE ? OR tags LIKE ?
      ORDER BY relevance_score DESC
      LIMIT ?
    `)
    const searchPattern = `%${query}%`
    const rows = stmt.all(searchPattern, searchPattern, searchPattern, limit) as any[]

    return rows.map(row => ({
      id: row.id,
      topic: row.topic,
      content: row.content,
      source: row.source,
      tags: JSON.parse(row.tags || '[]'),
      relevanceScore: row.relevance_score,
      createdAt: new Date(row.created_at)
    }))
  }

  getKnowledgeTopics(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT topic FROM knowledge_entries ORDER BY topic
    `)
    const rows = stmt.all() as any[]
    return rows.map(row => row.topic)
  }

  getKnowledgeStats(): {
    totalTopics: number
    totalEntries: number
    averageEntriesPerTopic: number
    topTopics: { topic: string; count: number }[]
  } {
    const totalEntriesStmt = this.db.prepare('SELECT COUNT(*) as count FROM knowledge_entries')
    const totalEntries = (totalEntriesStmt.get() as any).count

    const topicsStmt = this.db.prepare(`
      SELECT topic, COUNT(*) as count 
      FROM knowledge_entries 
      GROUP BY topic 
      ORDER BY count DESC 
      LIMIT 10
    `)
    const topTopics = topicsStmt.all() as any[]

    const totalTopics = topTopics.length

    return {
      totalTopics,
      totalEntries,
      averageEntriesPerTopic: totalTopics > 0 ? totalEntries / totalTopics : 0,
      topTopics: topTopics.map(row => ({ topic: row.topic, count: row.count }))
    }
  }

  deleteKnowledgeEntry(entryId: string): void {
    const stmt = this.db.prepare('DELETE FROM knowledge_entries WHERE id = ?')
    stmt.run(entryId)
  }

  // 从JSON文件迁移知识库数据
  async migrateKnowledgeFromJson(jsonPath: string): Promise<number> {
    try {
      const fs = await import('fs/promises')
      const data = await fs.readFile(jsonPath, 'utf-8')
      const knowledgeData = JSON.parse(data)
      
      let migratedCount = 0
      
      for (const [topic, entries] of Object.entries(knowledgeData)) {
        if (Array.isArray(entries)) {
          for (const entry of entries as any[]) {
            if (entry.id && entry.content) {
              this.saveKnowledgeEntry({
                id: entry.id,
                topic: topic,
                content: entry.content,
                source: entry.source || 'Migrated from JSON',
                tags: entry.tags || [],
                relevanceScore: entry.relevanceScore || 0.5,
                createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date()
              })
              migratedCount++
            }
          }
        }
      }
      
      console.log(`✅ Migrated ${migratedCount} knowledge entries from JSON`)
      return migratedCount
    } catch (error) {
      console.error('❌ Failed to migrate knowledge from JSON:', error)
      return 0
    }
  }
}