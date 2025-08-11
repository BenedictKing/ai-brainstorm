import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
import OpenAI from 'openai'

export class GrokProvider extends BaseAIProvider {
  private grok: OpenAI
  private baseUrl: string

  constructor(apiKey: string, model: string, baseUrl: string, providerName: string) {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`, // 使用传入的 model 和 providerName
      name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} (${model})`, // 使用传入的 model 和 providerName
      provider: providerName as 'grok', // 使用传入的 providerName
      maxTokens: 16384, // 可以考虑从配置中获取
      supportedFeatures: ['chat', 'reasoning', 'humor', 'real-time'],
    }

    super(apiKey, baseUrl, aiModel) // 使用传入的 baseUrl
    this.baseUrl = baseUrl
    this.grok = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl, // 使用传入的 baseUrl
    })
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
      model: 'grok-1.5-sonnet',
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 16384,
      stream: false,
    }

    // 日志记录
    const url = (this.constructor as any).combineURLs(this.baseUrl, endpoint)
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', { 'Authorization': `Bearer ${this.apiKey}` }, body)}\n\n`)
    
    // 使用SDK执行
    const completion = await this.grok.chat.completions.create(body as any)
    return { data: completion }
  }

  protected async makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const endpoint = '/chat/completions'
    const finalMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages
    const body = {
      model: 'grok-1.5-sonnet',
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 16384,
      stream: true,
    }

    // 日志记录
    const url = (this.constructor as any).combineURLs(this.baseUrl, endpoint)
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', { 'Authorization': `Bearer ${this.apiKey}` }, body)}\n\n`)

    // 使用SDK执行
    const stream = await this.grok.chat.completions.create(body as any)
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
