import { OpenAIProvider } from './OpenAIProvider.js';
import { ClaudeProvider } from './ClaudeProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { GrokProvider } from './GrokProvider.js';
import { BaseAIProvider } from './BaseAIProvider.js';
import { config } from '../config/index.js';

export class AIProviderFactory {
  private static providers: Map<string, BaseAIProvider> = new Map();

  static async createProvider(providerName: string): Promise<BaseAIProvider> {
    if (this.providers.has(providerName)) {
      return this.providers.get(providerName)!;
    }

    let provider: BaseAIProvider;

    switch (providerName.toLowerCase()) {
      case 'openai':
      case 'gpt':
        if (!config.apis.openai.apiKey) {
          throw new Error('OpenAI API key not configured');
        }
        provider = new OpenAIProvider(config.apis.openai.apiKey);
        break;

      case 'claude':
        if (!config.apis.claude.apiKey) {
          throw new Error('Claude API key not configured');
        }
        provider = new ClaudeProvider(config.apis.claude.apiKey);
        break;

      case 'gemini':
        if (!config.apis.gemini.apiKey) {
          throw new Error('Gemini API key not configured');
        }
        provider = new GeminiProvider(config.apis.gemini.apiKey);
        break;

      case 'grok':
        if (!config.apis.grok.apiKey) {
          throw new Error('Grok API key not configured');
        }
        provider = new GrokProvider(config.apis.grok.apiKey);
        break;

      default:
        throw new Error(`Unsupported AI provider: ${providerName}`);
    }

    this.providers.set(providerName, provider);
    return provider;
  }

  static getAvailableProviders(): string[] {
    const available = [];
    if (config.apis.openai.apiKey) available.push('openai');
    if (config.apis.claude.apiKey) available.push('claude');
    if (config.apis.gemini.apiKey) available.push('gemini');
    if (config.apis.grok.apiKey) available.push('grok');
    return available;
  }

  static async createAllAvailableProviders(): Promise<BaseAIProvider[]> {
    const availableProviders = this.getAvailableProviders();
    const providers = await Promise.all(
      availableProviders.map(name => this.createProvider(name))
    );
    return providers;
  }
}