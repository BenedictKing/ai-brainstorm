import { OpenAIProvider } from './OpenAIProvider.js'
import { ClaudeProvider } from './ClaudeProvider.js'
import { GeminiProvider } from './GeminiProvider.js'
import { GrokProvider } from './GrokProvider.js'
import { BaseAIProvider } from './BaseAIProvider.js'
import { config, ProviderConfig } from '../config/index.js'

export class AIProviderFactory {
  private static providers: Map<string, BaseAIProvider> = new Map()

  static async createProvider(providerName: string): Promise<BaseAIProvider> {
    if (this.providers.has(providerName)) {
      return this.providers.get(providerName)!
    }

    const providerConfig = config.apis[providerName]
    if (!providerConfig) {
      throw new Error(`Unknown AI provider: ${providerName}`)
    }

    if (!providerConfig.enabled) {
      throw new Error(`AI provider ${providerName} is not enabled`)
    }

    if (!providerConfig.apiKey) {
      throw new Error(`API key not configured for provider: ${providerName}`)
    }

    let provider: BaseAIProvider

    // 根据format字段选择适配器类型
    switch (providerConfig.format) {
      case 'openai':
        provider = new OpenAIProvider(providerConfig.apiKey, providerConfig.model, providerConfig.baseUrl, providerName)
        break

      case 'claude':
        provider = new ClaudeProvider(providerConfig.apiKey, providerConfig.model, providerConfig.baseUrl, providerName)
        break

      case 'gemini':
        provider = new GeminiProvider(providerConfig.apiKey, providerConfig.model, providerConfig.baseUrl, providerName)
        break

      case 'grok': // 添加 Grok 提供商的创建逻辑
        provider = new GrokProvider(providerConfig.apiKey, providerConfig.model, providerConfig.baseUrl, providerName)
        break

      default:
        throw new Error(`Unsupported provider format: ${providerConfig.format} for provider: ${providerName}`)
    }

    this.providers.set(providerName, provider)
    return provider
  }

  static getAvailableProviders(): string[] {
    return Object.entries(config.apis)
      .filter(([, providerConfig]: [string, ProviderConfig]) => providerConfig.enabled && providerConfig.apiKey)
      .map(([name]) => name)
  }

  static getAllProviderConfigs(): Record<string, ProviderConfig> {
    return { ...config.apis }
  }

  static getProviderConfig(providerName: string): ProviderConfig | undefined {
    return config.apis[providerName]
  }

  static async createAllAvailableProviders(): Promise<BaseAIProvider[]> {
    const availableProviders = this.getAvailableProviders()
    const providers = await Promise.all(availableProviders.map((name) => this.createProvider(name)))
    return providers
  }

  static validateProvider(providerName: string): boolean {
    const providerConfig = config.apis[providerName]
    return !!(providerConfig?.enabled && providerConfig?.apiKey)
  }

  static getProvidersByFormat(format: 'openai' | 'claude' | 'gemini'): string[] {
    return Object.entries(config.apis)
      .filter(
        ([, providerConfig]: [string, ProviderConfig]) =>
          providerConfig.enabled && providerConfig.apiKey && providerConfig.format === format
      )
      .map(([name]) => name)
  }
}
