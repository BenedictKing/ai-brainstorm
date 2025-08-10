import { BaseAIProvider } from './BaseAIProvider.js';
import { Message, AIModel } from '../types/index.js';

export class OpenAIProvider extends BaseAIProvider {
  constructor(apiKey: string, model = 'gpt-4') {
    const aiModel: AIModel = {
      id: 'openai-gpt4',
      name: 'GPT-4',
      provider: 'openai',
      maxTokens: 8192,
      supportedFeatures: ['chat', 'reasoning', 'code']
    };

    super(apiKey, 'https://api.openai.com/v1', aiModel);
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
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 2000
    });
  }
}