import { 
  KnowledgeEntry, 
  Conversation, 
  Message 
} from '../types/index.js';
import { AIProviderFactory } from '../models/index.js';
import { ContextCompressor } from './ContextCompressor.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface KnowledgeExtractionConfig {
  extractionModel?: string;
  minContentLength?: number;
  maxEntriesPerTopic?: number;
  similarityThreshold?: number;
  enableClustering?: boolean;
}

export class KnowledgeManager {
  private knowledgeBase: Map<string, KnowledgeEntry[]> = new Map();
  private config: Required<KnowledgeExtractionConfig>;
  private dataPath: string;

  constructor(
    dataPath = './data/knowledge.json',
    config: KnowledgeExtractionConfig = {}
  ) {
    this.dataPath = dataPath;
    this.config = {
      extractionModel: 'claude',
      minContentLength: 50,
      maxEntriesPerTopic: 100,
      similarityThreshold: 0.7,
      enableClustering: true,
      ...config
    };
    this.loadKnowledgeBase();
  }

  async extractKnowledgeFromConversation(conversation: Conversation): Promise<KnowledgeEntry[]> {
    if (conversation.messages.length < 3) {
      return [];
    }

    try {
      const provider = await AIProviderFactory.createProvider(this.config.extractionModel);
      
      const conversationContent = this.formatConversationForExtraction(conversation);
      
      const extractionPrompt = this.buildExtractionPrompt(conversationContent);
      
      const response = await provider.generateResponse([{
        id: 'extraction',
        role: 'user',
        content: extractionPrompt,
        timestamp: new Date()
      }], this.getExtractionSystemPrompt());

      const extractedEntries = this.parseExtractionResponse(response, conversation);
      
      for (const entry of extractedEntries) {
        await this.addKnowledgeEntry(entry);
      }

      return extractedEntries;

    } catch (error) {
      console.error('Knowledge extraction failed:', error);
      return this.fallbackExtraction(conversation);
    }
  }

  private formatConversationForExtraction(conversation: Conversation): string {
    const relevantMessages = conversation.messages.filter(m => 
      m.role === 'assistant' && m.content.length >= this.config.minContentLength
    );

    return relevantMessages.map((msg, index) => {
      const participant = msg.metadata?.participantName || msg.model || 'AI';
      return `### 观点 ${index + 1} (${participant}):\n${msg.content}`;
    }).join('\n\n');
  }

  private buildExtractionPrompt(content: string): string {
    return `请从以下AI讨论中提取有价值的知识点。每个知识点应该包含：

1. 主题标签（用于分类）
2. 核心内容（简洁明了的知识描述）
3. 相关标签（3-5个关键词）

讨论内容：
${content}

请按以下JSON格式输出：
{
  "knowledge_entries": [
    {
      "topic": "主题标签",
      "content": "核心知识内容",
      "tags": ["标签1", "标签2", "标签3"],
      "relevance_score": 0.8
    }
  ]
}

要求：
- 提取3-10个有价值的知识点
- 避免重复或相似的内容
- 确保内容具有实用价值
- 相关度评分范围0-1`;
  }

  private getExtractionSystemPrompt(): string {
    return `你是一个专业的知识提取专家。你的任务是从AI讨论中识别和提取有价值的知识点，这些知识点应该：

1. 具有实用性和指导意义
2. 内容准确且逻辑清晰
3. 可以独立理解和应用
4. 避免冗余和重复

请严格按照要求的JSON格式输出结果。`;
  }

  private parseExtractionResponse(response: string, conversation: Conversation): KnowledgeEntry[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const entries = parsed.knowledge_entries || [];

      return entries.map((entry: any) => ({
        id: uuidv4(),
        topic: entry.topic || 'General',
        content: entry.content || '',
        source: `Conversation: ${conversation.title}`,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        createdAt: new Date(),
        relevanceScore: entry.relevance_score || 0.5
      })).filter((entry: KnowledgeEntry) => 
        entry.content.length >= this.config.minContentLength
      );

    } catch (error) {
      console.error('Failed to parse extraction response:', error);
      return this.fallbackExtraction(conversation);
    }
  }

  private fallbackExtraction(conversation: Conversation): KnowledgeEntry[] {
    const assistantMessages = conversation.messages.filter(m => m.role === 'assistant');
    
    return assistantMessages.slice(0, 5).map(msg => ({
      id: uuidv4(),
      topic: conversation.title,
      content: msg.content.length > 200 
        ? msg.content.substring(0, 200) + '...' 
        : msg.content,
      source: `Conversation: ${conversation.title}`,
      tags: ['discussion', 'extracted'],
      createdAt: new Date(),
      relevanceScore: 0.3
    }));
  }

  async addKnowledgeEntry(entry: KnowledgeEntry): Promise<void> {
    const existingEntries = this.knowledgeBase.get(entry.topic) || [];
    
    const isDuplicate = existingEntries.some(existing => 
      this.calculateSimilarity(existing.content, entry.content) > this.config.similarityThreshold
    );

    if (!isDuplicate) {
      existingEntries.push(entry);
      
      if (existingEntries.length > this.config.maxEntriesPerTopic) {
        existingEntries.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        existingEntries.splice(this.config.maxEntriesPerTopic);
      }
      
      this.knowledgeBase.set(entry.topic, existingEntries);
      await this.saveKnowledgeBase();
    }
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  async searchKnowledge(
    query: string, 
    maxResults = 10
  ): Promise<KnowledgeEntry[]> {
    const allEntries: KnowledgeEntry[] = [];
    
    for (const entries of this.knowledgeBase.values()) {
      allEntries.push(...entries);
    }

    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    
    const scoredEntries = allEntries.map(entry => {
      const contentWords = new Set(entry.content.toLowerCase().split(/\s+/));
      const topicWords = new Set(entry.topic.toLowerCase().split(/\s+/));
      const tagWords = new Set(entry.tags.join(' ').toLowerCase().split(/\s+/));
      
      const contentScore = this.calculateSetIntersection(queryWords, contentWords) * 1.0;
      const topicScore = this.calculateSetIntersection(queryWords, topicWords) * 1.5;
      const tagScore = this.calculateSetIntersection(queryWords, tagWords) * 1.2;
      const relevanceScore = (entry.relevanceScore || 0) * 0.5;
      
      const totalScore = contentScore + topicScore + tagScore + relevanceScore;
      
      return { entry, score: totalScore };
    });

    return scoredEntries
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.entry);
  }

  private calculateSetIntersection(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(item => set2.has(item)));
    return intersection.size / Math.max(set1.size, set2.size);
  }

  async generateKnowledgeSummary(topic: string): Promise<string> {
    const entries = this.knowledgeBase.get(topic);
    if (!entries || entries.length === 0) {
      return `没有找到关于 "${topic}" 的知识条目。`;
    }

    try {
      const provider = await AIProviderFactory.createProvider(this.config.extractionModel);
      
      const entriesText = entries
        .slice(0, 10)
        .map((entry, index) => `${index + 1}. ${entry.content}`)
        .join('\n\n');

      const summaryPrompt = `请对以下关于"${topic}"的知识条目进行综合总结：

${entriesText}

要求：
1. 提炼出核心观点和主要结论
2. 整理成结构化的总结
3. 突出重要的洞察和建议
4. 保持简洁明了`;

      return await provider.generateResponse([{
        id: 'summary',
        role: 'user',
        content: summaryPrompt,
        timestamp: new Date()
      }], '你是一个专业的知识整理专家，擅长将分散的信息整合为结构化的总结。');

    } catch (error) {
      console.error('Failed to generate summary:', error);
      return this.generateBasicSummary(entries);
    }
  }

  private generateBasicSummary(entries: KnowledgeEntry[]): string {
    const topEntries = entries
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 5);

    return `关键知识点总结：\n\n${topEntries
      .map((entry, index) => `${index + 1}. ${entry.content}`)
      .join('\n\n')}`;
  }

  getTopicList(): string[] {
    return Array.from(this.knowledgeBase.keys()).sort();
  }

  getKnowledgeStats(): {
    totalTopics: number;
    totalEntries: number;
    averageEntriesPerTopic: number;
    topTopics: { topic: string; count: number }[];
  } {
    const topics = Array.from(this.knowledgeBase.entries());
    const totalEntries = topics.reduce((sum, [, entries]) => sum + entries.length, 0);

    const topTopics = topics
      .map(([topic, entries]) => ({ topic, count: entries.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTopics: topics.length,
      totalEntries,
      averageEntriesPerTopic: totalEntries / topics.length || 0,
      topTopics
    };
  }

  private async saveKnowledgeBase(): Promise<void> {
    try {
      const dataDir = path.dirname(this.dataPath);
      await fs.mkdir(dataDir, { recursive: true });

      const data = Object.fromEntries(this.knowledgeBase.entries());
      await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save knowledge base:', error);
    }
  }

  private async loadKnowledgeBase(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.knowledgeBase = new Map(Object.entries(parsed));
    } catch (error) {
      console.log('No existing knowledge base found, starting fresh');
      this.knowledgeBase = new Map();
    }
  }

  async exportKnowledge(format: 'json' | 'markdown' = 'json'): Promise<string> {
    if (format === 'markdown') {
      return this.exportToMarkdown();
    }
    
    const data = Object.fromEntries(this.knowledgeBase.entries());
    return JSON.stringify(data, null, 2);
  }

  private exportToMarkdown(): string {
    const topics = Array.from(this.knowledgeBase.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    let markdown = '# AI讨论知识库\n\n';
    markdown += `生成时间: ${new Date().toLocaleString()}\n\n`;
    
    for (const [topic, entries] of topics) {
      markdown += `## ${topic}\n\n`;
      
      const sortedEntries = entries.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      for (let i = 0; i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        markdown += `### ${i + 1}. 知识点\n\n`;
        markdown += `**内容:** ${entry.content}\n\n`;
        markdown += `**标签:** ${entry.tags.join(', ')}\n\n`;
        markdown += `**来源:** ${entry.source}\n\n`;
        markdown += `**相关度:** ${(entry.relevanceScore || 0).toFixed(2)}\n\n`;
        markdown += '---\n\n';
      }
    }
    
    return markdown;
  }
}