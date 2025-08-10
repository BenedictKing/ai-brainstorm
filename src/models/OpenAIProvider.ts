import { BaseAIProvider } from './BaseAIProvider.js';
import { Message, AIModel } from '../types/index.js';

export class OpenAIProvider extends BaseAIProvider {
  private modelName: string;

  constructor(
    apiKey: string, 
    model = 'gpt-4', 
    baseUrl = 'https://api.openai.com/v1',
    providerName = 'openai'
  ) {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`,
      name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} (${model})`,
      provider: 'openai',
      maxTokens: 8192,
      supportedFeatures: ['chat', 'reasoning', 'code']
    };

    super(apiKey, baseUrl, aiModel);
    this.modelName = model;
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
      model: this.modelName,
      messages,
      temperature: 0.7,
      max_tokens: 2000
    });
  }
}