import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
import Anthropic from '@anthropic-ai/sdk' // 恢复导入

export class ClaudeProvider extends BaseAIProvider {
  private modelName: string
  private anthropic: Anthropic // 恢复SDK实例

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
    this.anthropic = new Anthropic({ apiKey, baseURL: baseUrl }) // 初始化SDK
  }

  protected setupAuth(apiKey: string): void {
    // SDK handles auth automatically
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
    const body: Anthropic.Messages.MessageCreateParams = {
      model: this.modelName,
      max_tokens: 16384,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages as Anthropic.Messages.MessageParam[],
    }

    // 日志记录
    const url = new URL(endpoint, this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' }, body)}\n\n`)

    // 使用SDK执行
    const completion = await this.anthropic.messages.create(body)
    return { data: completion }
  }

  protected async makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const endpoint = '/messages'
    const body: Anthropic.Messages.MessageCreateParams = {
      model: this.modelName,
      max_tokens: 16384,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages as Anthropic.Messages.MessageParam[],
      stream: true,
    }

    // 日志记录
    const url = new URL(endpoint, this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' }, body)}\n\n`)

    // 使用SDK执行
    const stream = await this.anthropic.messages.create(body)
    return { data: stream }
  }

  // 覆盖基类方法以处理 Anthropic SDK 的流
  protected async handleStreamResponse(response: any): Promise<string> {
    const stream = response.data
    let fullContent = ''
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullContent += chunk.delta.text
      }
    }
    return fullContent
  }
}
