import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
// 移除 Anthropic SDK 导入

export class ClaudeProvider extends BaseAIProvider {
  private modelName: string
  // 移除 anthropic 成员

  constructor(apiKey: string, model: string, baseUrl = 'https://api.anthropic.com/v1', providerName: string) {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`, // 使用传入的 model 和 providerName
      name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} (${model})`, // 使用传入的 model 和 providerName
      provider: providerName as 'claude', // 使用传入的 providerName
      maxTokens: 200000, // 可以考虑从配置中获取
      supportedFeatures: ['chat', 'reasoning', 'analysis', 'code'],
    }

    super(apiKey, baseUrl, aiModel)
    this.modelName = model
  }

  protected setupAuth(apiKey: string): void {
    this.client.defaults.headers.common['x-api-key'] = apiKey
    this.client.defaults.headers.common['anthropic-version'] = '2023-06-01'
  }

  protected formatMessages(messages: Message[]): any[] {
    return messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
  }

  protected parseResponse(response: any): string {
    return response.content[0]?.text || ''
  }

  protected parseStreamResponse(chunk: string): string | null {
    try {
      const parsed = JSON.parse(chunk)
      if (parsed.type === 'content_block_delta') {
        return parsed.delta?.text || null
      }
      return null
    } catch {
      return null
    }
  }

  protected async makeRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const endpoint = '/messages'
    const body = {
      model: this.modelName,
      max_tokens: 16384,
      temperature: 0.7,
      system: systemPrompt || undefined,
      messages: messages,
    }

    const url = new URL(endpoint, this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', this.client.defaults.headers.common, body)}\n\n`)

    return this.client.post(endpoint, body)
  }

  protected async makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const endpoint = '/messages'
    const body = {
      model: this.modelName,
      max_tokens: 16384,
      temperature: 0.7,
      system: systemPrompt || undefined,
      messages: messages,
      stream: true,
    }

    const url = new URL(endpoint, this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', this.client.defaults.headers.common, body)}\n\n`)

    return this.client.post(endpoint, body, { responseType: 'stream' })
  }
}
