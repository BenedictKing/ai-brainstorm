import axios, { AxiosInstance } from 'axios';
import { Message, AIModel } from '../types/index.js';

export abstract class BaseAIProvider {
  protected client: AxiosInstance;
  protected model: AIModel;

  constructor(apiKey: string, baseUrl: string, model: AIModel) {
    this.model = model;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
    
    this.setupAuth(apiKey);
  }

  protected abstract setupAuth(apiKey: string): void;
  protected abstract formatMessages(messages: Message[]): any[];
  protected abstract parseResponse(response: any): string;

  async generateResponse(messages: Message[], systemPrompt?: string): Promise<string> {
    try {
      const formattedMessages = this.formatMessages(messages);
      if (systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      const response = await this.makeRequest(formattedMessages);
      return this.parseResponse(response.data);
    } catch (error) {
      console.error(`Error with ${this.model.provider}:`, error);
      throw new Error(`AI provider ${this.model.provider} failed: ${error}`);
    }
  }

  protected abstract makeRequest(messages: any[]): Promise<any>;
  
  getModel(): AIModel {
    return this.model;
  }
}