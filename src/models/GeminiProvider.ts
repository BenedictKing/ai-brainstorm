import { BaseAIProvider } from './BaseAIProvider.js';
import { Message, AIModel } from '../types/index.js';

export class GeminiProvider extends BaseAIProvider {
  constructor(apiKey: string, model = 'gemini-pro') {
    const aiModel: AIModel = {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'gemini',
      maxTokens: 32768,
      supportedFeatures: ['chat', 'reasoning', 'multimodal']
    };

    super(apiKey, 'https://generativelanguage.googleapis.com/v1beta', aiModel);
  }

  protected setupAuth(apiKey: string): void {
    this.client.defaults.params = { key: apiKey };
  }

  protected formatMessages(messages: Message[]): any[] {
    const contents = [];
    let currentRole = '';
    let currentParts: any[] = [];

    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      
      if (role !== currentRole && currentParts.length > 0) {
        contents.push({
          role: currentRole,
          parts: currentParts
        });
        currentParts = [];
      }
      
      currentRole = role;
      currentParts.push({ text: msg.content });
    }

    if (currentParts.length > 0) {
      contents.push({
        role: currentRole,
        parts: currentParts
      });
    }

    return contents;
  }

  protected parseResponse(response: any): string {
    return response.candidates[0]?.content?.parts[0]?.text || '';
  }

  protected async makeRequest(messages: any[]): Promise<any> {
    return this.client.post('/models/gemini-pro:generateContent', {
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    });
  }
}