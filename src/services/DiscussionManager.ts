import { AIProviderFactory } from '../models/index.js';
import { RoleManager } from './RoleManager.js';
import { Conversation, Message, DiscussionTopic, AIParticipant, APIResponse } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface DiscussionConfig {
  maxRounds?: number;
  responseTimeout?: number;
  enableRealTimeUpdates?: boolean;
}

export class DiscussionManager extends EventEmitter {
  private activeConversations: Map<string, Map<string, Conversation>> = new Map();
  private config: DiscussionConfig;

  constructor(config: DiscussionConfig = {}) {
    super();
    this.config = {
      maxRounds: 3,
      responseTimeout: 300000,
      enableRealTimeUpdates: true,
      ...config,
    };
  }

  private _getUserConversations(clientId: string): Map<string, Conversation> {
    if (!this.activeConversations.has(clientId)) {
      this.activeConversations.set(clientId, new Map());
    }
    return this.activeConversations.get(clientId)!;
  }

  async startDiscussion(clientId: string, topic: DiscussionTopic): Promise<string> {
    const conversationId = uuidv4();
    const userConversations = this._getUserConversations(clientId);

    if (!topic.participants || topic.participants.length < 2) {
      throw new Error('At least two participants are required to start a discussion.');
    }

    const aiParticipants: AIParticipant[] = [];
    for (const p of topic.participants) {
      const roleTemplate = RoleManager.getRoleById(p.roleId);
      if (!roleTemplate) {
        throw new Error(`Role template not found for roleId: ${p.roleId}`);
      }
      const participant = RoleManager.createParticipant(p.roleId, p.provider, roleTemplate.name); // Pass roleTemplate.name for participant name
      aiParticipants.push(participant);
    }

    if (aiParticipants.length < 2) {
      throw new Error('At least two AI providers must be enabled to start a discussion.');
    }

    const conversation: Conversation = {
      id: conversationId,
      title: this.generateTitle(topic.question),
      messages: [
        {
          id: uuidv4(),
          role: 'user',
          content: this.formatDiscussionPrompt(topic),
          timestamp: new Date(),
        },
      ],
      participants: aiParticipants,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      currentRound: 0,
      maxRounds: 1, // 目前讨论会模式固定为1轮
      tags: ['discussion', 'panel-mode'],
    };

    userConversations.set(conversationId, conversation);
    this.emit('discussionStarted', { clientId, conversationId, topic, participants: aiParticipants });

    this.runDiscussion(clientId, conversationId).catch((error) => {
      this.emit('discussionError', { clientId, conversationId, error });
    });

    return conversationId;
  }

  private async runDiscussion(clientId: string, conversationId: string): Promise<void> {
    const userConversations = this._getUserConversations(clientId);
    const conversation = userConversations.get(conversationId);
    if (!conversation) return;

    try {
      // 新的讨论会模式：先让支持者回答，然后其他角色进行思辨
      await this.runDiscussionRound(conversation, conversationId, clientId);

      conversation.status = 'completed';
      this.emit('discussionCompleted', {
        clientId,
        conversationId,
        conversation,
        totalMessages: conversation.messages.length,
      });
    } catch (error) {
      if (conversation) {
        conversation.status = 'error';
      }
      console.error('Discussion failed:', error);
      this.emit('discussionError', { clientId, conversationId, error });
    }
  }

  private async runDiscussionRound(
    conversation: Conversation,
    conversationId: string,
    clientId: string
  ): Promise<void> {
    const activeParticipants = conversation.participants.filter((p: AIParticipant) => p.isActive);

    // 定义讨论顺序：支持者先发言，然后是其他角色
    const discussionOrder = this.getDiscussionOrder(activeParticipants);

    conversation.currentRound = 1;
    this.emit('roundStarted', {
      clientId,
      conversationId,
      round: 1,
      maxRounds: 1,
      participants: discussionOrder,
    });

    // 确保初次发言人成功发言
    const firstSpeaker = discussionOrder[0];
    if (!firstSpeaker) {
      throw new Error('No participants available for discussion');
    }

    // 处理初次发言人的发言，包含重试机制
    const firstResponse = await this.getFirstSpeakerResponse(conversation, firstSpeaker, conversationId, clientId);
    if (!firstResponse || firstResponse.metadata?.isErrorMessage) {
      throw new Error('First speaker failed to provide a valid response');
    }

    conversation.messages.push(firstResponse);
    conversation.updatedAt = new Date();

    if (this.config.enableRealTimeUpdates) {
      this.emit('messageReceived', {
        clientId,
        conversationId,
        message: firstResponse,
        participantIndex: 0,
        totalParticipants: discussionOrder.length,
      });
    }

    // 给其他参与者时间处理，模拟真实讨论节奏
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 处理其他参与者的发言
    for (let i = 1; i < discussionOrder.length; i++) {
      const participant = discussionOrder[i];

      try {
        // 构建针对当前讨论状态的提示词
        const contextualPrompt = this.buildContextualPrompt(conversation, participant, false);

        const response = await this.getParticipantResponse(conversation, participant, contextualPrompt);

        if (response && !response.metadata?.isErrorMessage) {
          conversation.messages.push(response);
          conversation.updatedAt = new Date();

          if (this.config.enableRealTimeUpdates) {
            this.emit('messageReceived', {
              clientId,
              conversationId,
              message: response,
              participantIndex: i,
              totalParticipants: discussionOrder.length,
            });
          }

          // 给其他参与者时间处理，模拟真实讨论节奏
          if (i < discussionOrder.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.error(`Participant ${participant.name} failed to respond:`, error);
        // 其他参与者失败不会中断整个讨论，只是记录错误
      }
    }
  }

  private async getFirstSpeakerResponse(
    conversation: Conversation,
    participant: AIParticipant,
    conversationId: string,
    clientId: string
  ): Promise<Message | null> {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      console.log(`🎤 First speaker ${participant.name} attempt ${attempt}/${maxAttempts}`);

      try {
        // 构建初次发言人的提示词
        const contextualPrompt = this.buildContextualPrompt(conversation, participant, true);

        const response = await this.getParticipantResponse(conversation, participant, contextualPrompt);

        // 检查回应是否有效（非空且不是错误消息）
        if (
          response &&
          !response.metadata?.isErrorMessage &&
          response.content.trim().length > 0 &&
          !response.content.includes('暂时无法响应')
        ) {
          console.log(`✅ First speaker ${participant.name} provided valid response`);
          return response;
        } else {
          console.warn(
            `⚠️ First speaker ${participant.name} provided invalid response, attempt ${attempt}/${maxAttempts}`
          );

          // 发出重试通知
          if (this.config.enableRealTimeUpdates) {
            this.emit('firstSpeakerRetry', {
              clientId,
              conversationId,
              participantName: participant.name,
              attempt,
              maxAttempts,
              reason: response?.metadata?.isErrorMessage ? 'Error response' : 'Empty or invalid response',
            });
          }
        }
      } catch (error) {
        console.error(`❌ First speaker ${participant.name} attempt ${attempt} failed:`, error);

        // 发出重试通知
        if (this.config.enableRealTimeUpdates) {
          this.emit('firstSpeakerRetry', {
            clientId,
            conversationId,
            participantName: participant.name,
            attempt,
            maxAttempts,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // 如果不是最后一次尝试，等待一段时间再重试
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    console.error(`❌ First speaker ${participant.name} failed after ${maxAttempts} attempts`);
    return null;
  }

  private getDiscussionOrder(participants: AIParticipant[]): AIParticipant[] {
    // 确保Gemini模型第一个发言
    const geminiParticipant = participants.find((p) => p.model.provider === 'gemini');
    const otherParticipants = participants.filter((p) => p.model.provider !== 'gemini');

    if (!geminiParticipant) {
      // 如果Gemini由于某种原因不存在，则按原顺序返回，尽管startDiscussion中已有检查
      console.warn('Could not find Gemini participant for ordering. Proceeding with default order.');
      return participants;
    }

    return [geminiParticipant, ...otherParticipants];
  }

  private buildContextualPrompt(
    conversation: Conversation,
    participant: AIParticipant,
    isFirstSpeaker: boolean
  ): string {
    const originalQuestion = conversation.messages.find((m: Message) => m.role === 'user')?.content || '';

    if (isFirstSpeaker) {
      // Gemini的提示词：作为首个回答者，请全面回答问题
      return `你被指定为本次讨论的首位发言者。请针对以下问题提供一个全面、深入、结构化的基础回答。你的回答将作为后续讨论的起点。

问题：
${originalQuestion}`;
    } else {
      // 其他模型的提示词：基于问题和Gemini的回答进行思辨
      const firstResponse = conversation.messages.find((m: Message) => m.role === 'assistant');
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
    const activeParticipants = conversation.participants.filter((p: AIParticipant) => p.isActive);
    const responsePromises = activeParticipants.map((participant: AIParticipant) =>
      this.getParticipantResponse(conversation, participant)
    );

    try {
      const responses = await Promise.allSettled(responsePromises);

      return responses
        .filter(
          (result: PromiseSettledResult<Message>): result is PromiseFulfilledResult<Message> =>
            result.status === 'fulfilled'
        )
        .map((result: PromiseFulfilledResult<Message>) => result.value);
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
    const promptToUse = customPrompt || this.enhancePromptWithContext(participant.systemPrompt, conversation.messages);

    try {
      const response = await Promise.race([
        provider.generateResponse(contextMessages, promptToUse),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Response timeout after ${this.config.responseTimeout}ms`)),
            this.config.responseTimeout
          )
        ),
      ]);

      if (!response || response.trim().length === 0) {
        throw new Error(`Empty response from ${participant.name}`);
      }

      return {
        id: uuidv4(),
        role: 'assistant',
        content: response,
        model: participant.model.provider,
        timestamp: new Date(),
        metadata: {
          participantId: participant.id,
          participantName: participant.name,
          participantRole: participant.role,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `❌ Error getting response from ${participant.name} (${participant.model.provider}):`,
        errorMessage
      );

      // 返回错误消息，但保持讨论继续
      return {
        id: uuidv4(),
        role: 'assistant',
        content: `[${participant.name} 暂时无法响应: ${errorMessage}]`,
        model: participant.model.provider,
        timestamp: new Date(),
        metadata: {
          participantId: participant.id,
          participantName: participant.name,
          participantRole: participant.role,
          error: errorMessage,
          isErrorMessage: true,
        },
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
      .filter((m) => m.role === 'assistant')
      .map((m) => m.content)
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

  getConversation(clientId: string, conversationId: string): Conversation | undefined {
    const userConversations = this._getUserConversations(clientId);
    return userConversations.get(conversationId);
  }

  getAllConversations(clientId: string): Conversation[] {
    const userConversations = this._getUserConversations(clientId);
    return Array.from(userConversations.values());
  }

  updateParticipant(
    clientId: string,
    conversationId: string,
    participantId: string,
    updates: Partial<AIParticipant>
  ): boolean {
    const conversation = this.getConversation(clientId, conversationId);
    if (!conversation) return false;

    const participantIndex = conversation.participants.findIndex((p: AIParticipant) => p.id === participantId);
    if (participantIndex === -1) return false;

    conversation.participants[participantIndex] = {
      ...conversation.participants[participantIndex],
      ...updates,
    };

    conversation.updatedAt = new Date();
    return true;
  }

  addMessage(
    clientId: string,
    conversationId: string,
    message: Omit<Message, 'id' | 'timestamp'>
  ): boolean {
    const conversation = this.getConversation(clientId, conversationId);
    if (!conversation) return false;

    const newMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };

    conversation.messages.push(newMessage);
    conversation.updatedAt = new Date();

    this.emit('messageAdded', { clientId, conversationId, message: newMessage });
    return true;
  }

  stopDiscussion(clientId: string, conversationId: string): boolean {
    const conversation = this.getConversation(clientId, conversationId);
    if (!conversation) return false;

    this.emit('discussionStopped', { clientId, conversationId });
    return true;
  }
}
