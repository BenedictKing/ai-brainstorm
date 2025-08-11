import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
// 移除 OpenAI SDK 导入

export class OpenAIProvider extends BaseAIProvider {
  private modelName: string
  // 移除 openai 成员

  constructor(apiKey: string, model = 'gpt-4o', baseUrl = 'https://api.openai.com/v1', providerName = 'openai') {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`,
      name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} (${model})`,
      provider: 'openai',
      maxTokens: 16384,
      supportedFeatures: ['chat', 'reasoning', 'code'],
    }

    super(apiKey, baseUrl, aiModel)
    this.modelName = model
  }

  protected setupAuth(apiKey: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`
  }

  protected formatMessages(messages: Message[]): any[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
  }

  protected parseResponse(response: any): string {
    return response.choices[0]?.message?.content || ''
  }

  protected parseStreamResponse(chunk: string): string | null {
    try {
      const parsed = JSON.parse(chunk)
      return parsed.choices?.[0]?.delta?.content || null
    } catch {
      return null
    }
  }

  protected async makeRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const endpoint = '/chat/completions'
    const finalMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages
    const body = {
      model: this.modelName,
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 16384,
    }

    const url = new URL(endpoint, this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', this.client.defaults.headers.common, body)}\n\n`)

    return this.client.post(endpoint, body)
  }

  protected async makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const endpoint = '/chat/completions'
    const finalMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages
    const body = {
      model: this.modelName,
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 16384,
      stream: true,
    }

    const url = new URL(endpoint, this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', this.client.defaults.headers.common, body)}\n\n`)
    
    return this.client.post(endpoint, body, { responseType: 'stream' })
  }
}
