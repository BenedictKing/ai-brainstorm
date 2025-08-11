import { Message, ContextCompressionResult } from '../types/index.js';
import { AIProviderFactory } from '../models/index.js';
import { config } from '../config/index.js';

export interface CompressionOptions {
  targetLength?: number;
  preserveSystemMessages?: boolean;
  preserveRecentMessages?: number;
  extractKeyPoints?: boolean;
  compressionModel?: string;
}

export class ContextCompressor {
  private static readonly DEFAULT_OPTIONS: Required<CompressionOptions> = {
    targetLength: config.context.maxLength,
    preserveSystemMessages: true,
    preserveRecentMessages: 3,
    extractKeyPoints: true,
    compressionModel: config.context.compressionProvider
  };

  static async compressMessages(
    messages: Message[], 
    options: CompressionOptions = {}
  ): Promise<ContextCompressionResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    if (messages.length === 0) {
      return {
        compressedContent: '',
        originalLength: 0,
        compressedLength: 0,
        compressionRatio: 0,
        keyPoints: []
      };
    }

    const originalContent = this.messagesToText(messages);
    const originalLength = originalContent.length;

    if (originalLength <= opts.targetLength) {
      return {
        compressedContent: originalContent,
        originalLength,
        compressedLength: originalLength,
        compressionRatio: 1,
        keyPoints: await this.extractKeyPoints(messages, opts.compressionModel)
      };
    }

    const { preservedMessages, compressibleMessages } = this.categorizeMessages(messages, opts);
    
    let compressedContent = '';
    
    if (preservedMessages.length > 0) {
      compressedContent += this.messagesToText(preservedMessages) + '\n\n';
    }

    if (compressibleMessages.length > 0) {
      const compressed = await this.performCompression(compressibleMessages, opts);
      compressedContent += `[压缩总结]:\n${compressed}\n\n`;
    }

    const keyPoints = opts.extractKeyPoints 
      ? await this.extractKeyPoints(messages, opts.compressionModel)
      : [];

    return {
      compressedContent: compressedContent.trim(),
      originalLength,
      compressedLength: compressedContent.length,
      compressionRatio: compressedContent.length / originalLength,
      keyPoints
    };
  }

  private static categorizeMessages(
    messages: Message[], 
    options: Required<CompressionOptions>
  ): { preservedMessages: Message[]; compressibleMessages: Message[] } {
    const preservedMessages: Message[] = [];
    const compressibleMessages: Message[] = [];

    const systemMessages = messages.filter(m => m.role === 'system');
    const recentMessages = messages.slice(-options.preserveRecentMessages);
    const middleMessages = messages.slice(
      systemMessages.length, 
      messages.length - options.preserveRecentMessages
    );

    if (options.preserveSystemMessages) {
      preservedMessages.push(...systemMessages);
    }
    
    preservedMessages.push(...recentMessages);
    compressibleMessages.push(...middleMessages);

    return { preservedMessages, compressibleMessages };
  }

  private static async performCompression(
    messages: Message[], 
    options: Required<CompressionOptions>
  ): Promise<string> {
    if (messages.length === 0) return '';

    try {
      const provider = await AIProviderFactory.createProvider(options.compressionModel);
      const content = this.messagesToText(messages);

      const compressionPrompt = `请将以下对话内容压缩为简洁的总结，保留关键信息和主要观点：

原始内容：
${content}

要求：
1. 保留核心论点和重要观点
2. 去除冗余和重复内容  
3. 保持逻辑连贯性
4. 控制长度在原文的${Math.round(options.targetLength * 100 / content.length)}%以内

压缩总结：`;

      const systemPrompt = '你是一个专业的内容压缩专家，擅长将长文本压缩为精炼的总结，同时保留关键信息。';
      
      return await provider.generateResponse([{
        id: 'compression',
        role: 'user',
        content: compressionPrompt,
        timestamp: new Date()
      }], systemPrompt);

    } catch (error) {
      console.error('Compression failed:', error);
      return this.fallbackCompression(messages);
    }
  }

  private static fallbackCompression(messages: Message[]): string {
    const summary = messages
      .filter(m => m.role === 'assistant')
      .map(m => {
        const content = m.content.length > 100 
          ? m.content.substring(0, 100) + '...' 
          : m.content;
        return `${m.model || 'AI'}: ${content}`;
      })
      .join('\n');

    return summary || '对话摘要不可用';
  }

  private static async extractKeyPoints(
    messages: Message[], 
    model: string
  ): Promise<string[]> {
    if (messages.length === 0) return [];

    try {
      const provider = await AIProviderFactory.createProvider(model);
      const content = this.messagesToText(messages);

      const keyPointsPrompt = `请从以下对话中提取5-10个关键要点：

对话内容：
${content}

请以简洁的要点形式输出，每行一个要点，使用"-"开头。`;

      const response = await provider.generateResponse([{
        id: 'keypoints',
        role: 'user',
        content: keyPointsPrompt,
        timestamp: new Date()
      }], '你是一个专业的内容分析专家，擅长提取文本中的关键要点。');

      return this.parseKeyPoints(response);
    } catch (error) {
      console.error('Key points extraction failed:', error);
      return this.extractBasicKeyPoints(messages);
    }
  }

  private static parseKeyPoints(response: string): string[] {
    return response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-') || line.match(/^\d+\./))
      .map(line => line.replace(/^[-\d.\s]+/, '').trim())
      .filter(point => point.length > 0)
      .slice(0, 10);
  }

  private static extractBasicKeyPoints(messages: Message[]): string[] {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    return assistantMessages
      .map(m => {
        const sentences = m.content.split(/[.!?。！？]/).filter(s => s.trim().length > 10);
        return sentences[0]?.trim();
      })
      .filter(point => point && point.length > 0)
      .slice(0, 5);
  }

  private static messagesToText(messages: Message[]): string {
    return messages
      .map(m => {
        const role = m.role === 'assistant' ? (m.model || 'AI') : '用户';
        return `${role}: ${m.content}`;
      })
      .join('\n\n');
  }

  static calculateOptimalCompressionRatio(
    currentLength: number, 
    targetLength: number, 
    preservedContentLength: number
  ): number {
    if (currentLength <= targetLength) return 1;
    
    const compressibleLength = currentLength - preservedContentLength;
    const availableSpace = targetLength - preservedContentLength;
    
    return Math.max(0.1, availableSpace / compressibleLength);
  }

  static async smartCompress(
    messages: Message[],
    targetLength: number,
    preserveRecent: number = 3
  ): Promise<ContextCompressionResult> {
    const options: CompressionOptions = {
      targetLength,
      preserveRecentMessages: preserveRecent,
      extractKeyPoints: true,
      compressionModel: config.context.compressionProvider
    };

    return this.compressMessages(messages, options);
  }
}