import { BaseAIProvider } from './BaseAIProvider.js';
import { Message, AIModel } from '../types/index.js';

export class GrokProvider extends BaseAIProvider {
  constructor(apiKey: string, model = 'grok-beta') {
    const aiModel: AIModel = {
      id: 'grok-beta',
      name: 'Grok Beta',
      provider: 'grok',
      maxTokens: 8192,
      supportedFeatures: ['chat', 'reasoning', 'humor', 'real-time']
    };

    super(apiKey, 'https://api.x.ai/v1', aiModel);
  }

  protected setupAuth(apiKey: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
  }

  protected formatMessages(messages: Message[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  protected parseResponse(response: any): string {
    return response.choices[0]?.message?.content || '';
  }

  protected async makeRequest(messages: any[]): Promise<any> {
    return this.client.post('/chat/completions', {
      model: 'grok-beta',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    });
  }
}