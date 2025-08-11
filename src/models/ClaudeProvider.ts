import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
import Anthropic from '@anthropic-ai/sdk'

export class ClaudeProvider extends BaseAIProvider {
  private modelName: string
  private anthropic: Anthropic

  constructor(
    apiKey: string,
    model = 'claude-3-5-sonnet-20241022',
    baseUrl = 'https://api.anthropic.com/v1',
    providerName = 'claude'
  ) {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`,
      name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} (${model})`,
      provider: 'claude',
      maxTokens: 200000,
      supportedFeatures: ['chat', 'reasoning', 'analysis', 'code'],
    }

    super(apiKey, baseUrl, aiModel)
    this.modelName = model
    this.anthropic = new Anthropic({
      apiKey: apiKey,
      baseURL: baseUrl,
    })
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
    const completion = await this.anthropic.messages.create({
      model: this.modelName,
      max_tokens: 16384,
      temperature: 0.7,
      system: systemPrompt || '',
      messages: messages,
    })

    return { data: completion }
  }

  protected async makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const stream = await this.anthropic.messages.create({
      model: this.modelName,
      max_tokens: 16384,
      temperature: 0.7,
      system: systemPrompt || '',
      messages: messages,
      stream: true,
    })

    return { data: stream }
  }
}
