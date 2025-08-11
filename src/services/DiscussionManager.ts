import { AIProviderFactory } from '../models';
import { RoleManager } from './RoleManager';
import { 
  Conversation, 
  Message, 
  DiscussionTopic, 
  AIParticipant,
  APIResponse 
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface DiscussionConfig {
  maxRounds?: number;
  responseTimeout?: number;
  enableRealTimeUpdates?: boolean;
}

export class DiscussionManager extends EventEmitter {
  private activeConversations: Map<string, Conversation> = new Map();
  private config: DiscussionConfig;

  constructor(config: DiscussionConfig = {}) {
    super();
    this.config = {
      maxRounds: 3,
      responseTimeout: 30000,
      enableRealTimeUpdates: true,
      ...config
    };
  }

  async startDiscussion(
    topic: DiscussionTopic
  ): Promise<string> {
    const conversationId = uuidv4();
    
    // 固定的讨论会参与者
    const discussionProviders = ['gemini', 'claude', 'openai', 'grok'];
    const availableProviders = AIProviderFactory.getAvailableProviders();

    // 筛选出已启用并配置了API Key的提供商
    const validProviders = discussionProviders.filter(p => availableProviders.includes(p));

    if (!validProviders.includes('gemini')) {
      throw new Error("Gemini provider is not available or configured. It's required for the initial response.");
    }
    
    const aiParticipants: AIParticipant[] = [];
    const expertRole = RoleManager.getRoleById('expert'); // 使用"领域专家"作为基础角色模板
    if (!expertRole) {
      throw new Error("Default 'expert' role not found.");
    }

    for (const provider of validProviders) {
      // 为每个参与者创建一个更具描述性的名字
      const participantName = `${provider.charAt(0).toUpperCase() + provider.slice(1)} (${expertRole.name})`;
      const participant = RoleManager.createParticipant(expertRole.id, provider, participantName);
      aiParticipants.push(participant);
    }

    if (aiParticipants.length < 2) {
      throw new Error('At least two AI providers must be enabled to start a discussion.');
    }

    const conversation: Conversation = {
      id: conversationId,
      title: this.generateTitle(topic.question),
      messages: [{
        id: uuidv4(),
        role: 'user',
        content: this.formatDiscussionPrompt(topic),
        timestamp: new Date()
      }],
      participants: aiParticipants,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['discussion', 'panel-mode']
    };

    this.activeConversations.set(conversationId, conversation);
    // 在startDiscussion的参数中移除participants
    this.emit('discussionStarted', { conversationId, topic, participants: aiParticipants });

    this.runDiscussion(conversationId).catch(error => {
      this.emit('discussionError', { conversationId, error });
    });

    return conversationId;
  }

  private async runDiscussion(conversationId: string): Promise<void> {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    try {
      // 新的讨论会模式：先让支持者回答，然后其他角色进行思辨
      await this.runDiscussionRound(conversation, conversationId);

      this.emit('discussionCompleted', { 
        conversationId, 
        conversation,
        totalMessages: conversation.messages.length 
      });
    } catch (error) {
      console.error('Discussion failed:', error);
      this.emit('discussionError', { conversationId, error });
    }
  }

  private async runDiscussionRound(conversation: Conversation, conversationId: string): Promise<void> {
    const activeParticipants = conversation.participants.filter(p => p.isActive);
    
    // 定义讨论顺序：支持者先发言，然后是其他角色
    const discussionOrder = this.getDiscussionOrder(activeParticipants);
    
    this.emit('roundStarted', { 
      conversationId, 
      round: 1, 
      maxRounds: 1,
      participants: discussionOrder.map(p => p.name)
    });

    // 按顺序让每个参与者发言
    for (let i = 0; i < discussionOrder.length; i++) {
      const participant = discussionOrder[i];
      
      try {
        // 构建针对当前讨论状态的提示词
        const contextualPrompt = this.buildContextualPrompt(conversation, participant, i === 0);
        
        const response = await this.getParticipantResponse(
          conversation, 
          participant, 
          contextualPrompt
        );
        
        if (response) {
          conversation.messages.push(response);
          conversation.updatedAt = new Date();
          
          if (this.config.enableRealTimeUpdates) {
            this.emit('messageReceived', { 
              conversationId, 
              message: response,
              participantIndex: i,
              totalParticipants: discussionOrder.length
            });
          }

          // 给其他参与者时间处理，模拟真实讨论节奏
          if (i < discussionOrder.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.error(`Participant ${participant.name} failed to respond:`, error);
      }
    }
  }

  private getDiscussionOrder(participants: AIParticipant[]): AIParticipant[] {
    // 确保Gemini模型第一个发言
    const geminiParticipant = participants.find(p => p.model.provider === 'gemini');
    const otherParticipants = participants.filter(p => p.model.provider !== 'gemini');

    if (!geminiParticipant) {
      // 如果Gemini由于某种原因不存在，则按原顺序返回，尽管startDiscussion中已有检查
      console.warn("Could not find Gemini participant for ordering. Proceeding with default order.");
      return participants;
    }
    
    return [geminiParticipant, ...otherParticipants];
  }


  private buildContextualPrompt(conversation: Conversation, participant: AIParticipant, isFirstSpeaker: boolean): string {
    const originalQuestion = conversation.messages.find(m => m.role === 'user')?.content || '';

    if (isFirstSpeaker) {
      // Gemini的提示词：作为首个回答者，请全面回答问题
      return `你被指定为本次讨论的首位发言者。请针对以下问题提供一个全面、深入、结构化的基础回答。你的回答将作为后续讨论的起点。

问题：
${originalQuestion}`;
    } else {
      // 其他模型的提示词：基于问题和Gemini的回答进行思辨
      const firstResponse = conversation.messages.find(m => m.role === 'assistant');
      const firstSpeakerName = firstResponse?.metadata?.participantName || '首位发言者';
      const firstAnswer = firstResponse?.content || '（首位发言者未能提供回答）';

      return `这是一个专题讨论会。请仔细阅读原始问题以及由 ${firstSpeakerName} 提供的基础回答。

你的任务是基于上述内容，从你的专业角度提出独特的思辨、反馈、质疑、补充或完全不同的观点。请确保你的发言具有深度和洞察力。

原始问题：
${originalQuestion}

${firstSpeakerName} 的回答：
${firstAnswer}

现在，请开始你的思辨和反馈：`;
    }
  }

  private async collectResponses(conversation: Conversation): Promise<Message[]> {
    const activeParticipants = conversation.participants.filter(p => p.isActive);
    const responsePromises = activeParticipants.map(participant => 
      this.getParticipantResponse(conversation, participant)
    );

    try {
      const responses = await Promise.allSettled(responsePromises);
      
      return responses
        .filter((result): result is PromiseFulfilledResult<Message> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);
    } catch (error) {
      console.error('Error collecting responses:', error);
      return [];
    }
  }

  private async getParticipantResponse(
    conversation: Conversation, 
    participant: AIParticipant,
    customPrompt?: string
  ): Promise<Message> {
    const provider = await AIProviderFactory.createProvider(participant.model.provider);
    
    const contextMessages = conversation.messages.slice(-10);
    
    // 使用自定义提示词或默认的增强提示词
    const promptToUse = customPrompt || this.enhancePromptWithContext(
      participant.systemPrompt,
      conversation.messages
    );

    try {
      const response = await Promise.race([
        provider.generateResponse(contextMessages, promptToUse),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.config.responseTimeout)
        )
      ]);

      return {
        id: uuidv4(),
        role: 'assistant',
        content: response, // 直接使用AI的回答，不再格式化
        model: participant.model.provider,
        timestamp: new Date(),
        metadata: {
          participantId: participant.id,
          participantName: participant.name,
          participantRole: participant.role
        }
      };
    } catch (error) {
      console.error(`Error getting response from ${participant.name}:`, error);
      
      return {
        id: uuidv4(),
        role: 'assistant',
        content: `[无法获取响应]`,
        model: participant.model.provider,
        timestamp: new Date(),
        metadata: {
          participantId: participant.id,
          participantName: participant.name,
          participantRole: participant.role,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private formatDiscussionPrompt(topic: DiscussionTopic): string {
    let prompt = `讨论话题：${topic.question}`;
    
    if (topic.context) {
      prompt += `\n\n背景信息：${topic.context}`;
    }
    
    prompt += '\n\n请各位AI助手从自己的角色出发，对这个话题进行深入讨论。';
    
    return prompt;
  }

  private enhancePromptWithContext(systemPrompt: string, messages: Message[]): string {
    const recentMessages = messages.slice(-5);
    const context = recentMessages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n\n');
    
    if (context) {
      return `${systemPrompt}\n\n当前讨论上下文：\n${context}\n\n请基于以上讨论内容，从你的角色出发提供回应。`;
    }
    
    return systemPrompt;
  }

  private formatParticipantResponse(participantName: string, response: string): string {
    return `**${participantName}**: ${response}`;
  }

  private generateTitle(question: string): string {
    const maxLength = 50;
    if (question.length <= maxLength) {
      return question;
    }
    return question.substring(0, maxLength - 3) + '...';
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this.activeConversations.get(conversationId);
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.activeConversations.values());
  }

  updateParticipant(
    conversationId: string, 
    participantId: string, 
    updates: Partial<AIParticipant>
  ): boolean {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return false;

    const participantIndex = conversation.participants.findIndex(p => p.id === participantId);
    if (participantIndex === -1) return false;

    conversation.participants[participantIndex] = {
      ...conversation.participants[participantIndex],
      ...updates
    };
    
    conversation.updatedAt = new Date();
    return true;
  }

  addMessage(conversationId: string, message: Omit<Message, 'id' | 'timestamp'>): boolean {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return false;

    const newMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: new Date()
    };

    conversation.messages.push(newMessage);
    conversation.updatedAt = new Date();

    this.emit('messageAdded', { conversationId, message: newMessage });
    return true;
  }

  stopDiscussion(conversationId: string): boolean {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return false;

    this.emit('discussionStopped', { conversationId });
    return true;
  }
}
