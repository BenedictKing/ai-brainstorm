import { BaseAIProvider } from './BaseAIProvider.js';
import { Message, AIModel } from '../types/index.js';

export class ClaudeProvider extends BaseAIProvider {
  constructor(apiKey: string, model = 'claude-3-sonnet-20240229') {
    const aiModel: AIModel = {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'claude',
      maxTokens: 200000,
      supportedFeatures: ['chat', 'reasoning', 'analysis', 'code']
    };

    super(apiKey, 'https://api.anthropic.com/v1', aiModel);
  }

  protected setupAuth(apiKey: string): void {
    this.client.defaults.headers.common['x-api-key'] = apiKey;
    this.client.defaults.headers.common['anthropic-version'] = '2023-06-01';
  }

  protected formatMessages(messages: Message[]): any[] {
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
  }

  protected parseResponse(response: any): string {
    return response.content[0]?.text || '';
  }

  protected async makeRequest(messages: any[]): Promise<any> {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    return this.client.post('/messages', {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      temperature: 0.7,
      system: systemMessage?.content || '',
      messages: userMessages
    });
  }
}