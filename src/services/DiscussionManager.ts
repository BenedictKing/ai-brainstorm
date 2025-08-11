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
    topic: DiscussionTopic,
    participants: string[] = ['critic', 'supporter', 'synthesizer']
  ): Promise<string> {
    const conversationId = uuidv4();
    
    const aiParticipants: AIParticipant[] = [];
    const availableProviders = AIProviderFactory.getAvailableProviders();
    
    for (let i = 0; i < participants.length; i++) {
      const roleId = participants[i];
      const providerIndex = i % availableProviders.length;
      const provider = availableProviders[providerIndex];
      
      try {
        const participant = RoleManager.createParticipant(roleId, provider);
        aiParticipants.push(participant);
      } catch (error) {
        console.warn(`Failed to create participant for role ${roleId}:`, error);
      }
    }

    if (aiParticipants.length === 0) {
      throw new Error('No participants could be created for the discussion');
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
      tags: ['discussion', 'multi-ai']
    };

    this.activeConversations.set(conversationId, conversation);
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
    // 优先级：支持者 > 批判者 > 创新者 > 专家 > 综合者 > 魔鬼代言人
    const roleOrder = ['supporter', 'critic', 'innovator', 'expert', 'synthesizer', 'devil_advocate'];
    
    const orderedParticipants: AIParticipant[] = [];
    const remainingParticipants = [...participants];

    // 按角色优先级排序
    roleOrder.forEach(roleId => {
      const participant = remainingParticipants.find(p => 
        p.name.includes(this.getRoleNameById(roleId))
      );
      if (participant) {
        orderedParticipants.push(participant);
        const index = remainingParticipants.indexOf(participant);
        remainingParticipants.splice(index, 1);
      }
    });

    // 添加任何剩余的参与者
    orderedParticipants.push(...remainingParticipants);

    return orderedParticipants;
  }

  private getRoleNameById(roleId: string): string {
    const roleNames: Record<string, string> = {
      'supporter': '支持者',
      'critic': '批判性思考者',
      'innovator': '创新者',
      'expert': '领域专家',
      'synthesizer': '综合者',
      'devil_advocate': '魔鬼代言人'
    };
    return roleNames[roleId] || roleId;
  }

  private buildContextualPrompt(conversation: Conversation, participant: AIParticipant, isFirstSpeaker: boolean): string {
    const originalQuestion = conversation.messages.find(m => m.role === 'user')?.content || '';
    const previousResponses = conversation.messages.filter(m => m.role === 'assistant');

    if (isFirstSpeaker) {
      // 第一个发言者（通常是支持者）直接回答问题
      return `请针对以下问题提供你的观点和分析：

问题：${originalQuestion}

请提供详细、有建设性的回答。`;
    } else {
      // 后续发言者需要参考之前的讨论内容
      const previousDiscussion = previousResponses.map((msg, index) => 
        `${msg.metadata?.participantName || `发言者${index + 1}`}：${msg.content}`
      ).join('\n\n');

      return `这是一个讨论会，请基于以下问题和之前的发言，提供你的思辨和反馈：

原始问题：${originalQuestion}

之前的讨论：
${previousDiscussion}

请针对原始问题和上述讨论内容，提供你的独特观点、思辨或反馈。可以支持、质疑、补充或从新角度分析。`;
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