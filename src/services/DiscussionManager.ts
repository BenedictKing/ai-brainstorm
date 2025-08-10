import { AIProviderFactory } from '../models/index.js';
import { RoleManager } from './RoleManager.js';
import { 
  Conversation, 
  Message, 
  DiscussionTopic, 
  AIParticipant,
  APIResponse 
} from '../types/index.js';
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

    const maxRounds = this.config.maxRounds || 3;
    
    for (let round = 0; round < maxRounds; round++) {
      this.emit('roundStarted', { conversationId, round: round + 1, maxRounds });
      
      const responses = await this.collectResponses(conversation);
      
      for (const response of responses) {
        conversation.messages.push(response);
        conversation.updatedAt = new Date();
        
        if (this.config.enableRealTimeUpdates) {
          this.emit('messageReceived', { 
            conversationId, 
            message: response, 
            round: round + 1 
          });
        }
      }

      if (round < maxRounds - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.emit('discussionCompleted', { 
      conversationId, 
      conversation,
      totalMessages: conversation.messages.length 
    });
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
    participant: AIParticipant
  ): Promise<Message> {
    const provider = await AIProviderFactory.createProvider(participant.model.provider);
    
    const contextMessages = conversation.messages.slice(-10);
    
    const enhancedPrompt = this.enhancePromptWithContext(
      participant.systemPrompt,
      conversation.messages
    );

    try {
      const response = await Promise.race([
        provider.generateResponse(contextMessages, enhancedPrompt),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.config.responseTimeout)
        )
      ]);

      return {
        id: uuidv4(),
        role: 'assistant',
        content: this.formatParticipantResponse(participant.name, response),
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
        content: `${participant.name}: [无法获取响应]`,
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