import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
import OpenAI from 'openai' // 恢复导入

export class OpenAIProvider extends BaseAIProvider {
  private modelName: string
  private openai: OpenAI // 恢复SDK实例

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
    this.openai = new OpenAI({ apiKey, baseURL: baseUrl }) // 初始化SDK
  }

  protected setupAuth(apiKey: string): void {
    // SDK handles auth automatically
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

    // 日志记录
    const url = new URL(endpoint, this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', { 'Authorization': `Bearer ${this.apiKey}` }, body)}\n\n`)

    // 使用SDK执行
    const completion = await this.openai.chat.completions.create(body)
    return { data: completion }
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

    // 日志记录
    const url = new URL(endpoint, this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', { 'Authorization': `Bearer ${this.apiKey}` }, body)}\n\n`)
    
    // 使用SDK执行
    const stream = await this.openai.chat.completions.create(body)
    return { data: stream }
  }
  
  // 覆盖基类方法以处理 OpenAI SDK 的流
  protected async handleStreamResponse(response: any): Promise<string> {
    const stream = response.data
    let fullContent = ''
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullContent += content
      }
    }
    return fullContent
  }
}
