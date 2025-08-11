import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
import OpenAI from 'openai'

export class GrokProvider extends BaseAIProvider {
  private grok: OpenAI

  constructor(apiKey: string, model: string, baseUrl: string, providerName: string) {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`, // 使用传入的 model 和 providerName
      name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} (${model})`, // 使用传入的 model 和 providerName
      provider: providerName as 'grok', // 使用传入的 providerName
      maxTokens: 16384, // 可以考虑从配置中获取
      supportedFeatures: ['chat', 'reasoning', 'humor', 'real-time'],
    }

    super(apiKey, baseUrl, aiModel) // 使用传入的 baseUrl
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
    const finalMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages

    const completion = await this.grok.chat.completions.create({
      model: 'grok-1.5-sonnet', // 修正为固定的 Grok 模型名称
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 16384,
      stream: false,
    })

    return { data: completion }
  }

  protected async makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const finalMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages

    const stream = await this.grok.chat.completions.create({
      model: 'grok-1.5-sonnet', // 修正为固定的 Grok 模型名称
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 16384,
      stream: true,
    })

    return { data: stream }
  }
}
