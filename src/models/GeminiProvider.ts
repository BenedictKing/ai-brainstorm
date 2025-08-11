import { BaseAIProvider } from './BaseAIProvider.js'
import { Message, AIModel } from '../types/index.js'
// 移除 GoogleGenerativeAI SDK 导入

export class GeminiProvider extends BaseAIProvider {
  private modelName: string
  // 移除 genAI 成员

  constructor(apiKey: string, model = 'gemini-1.5-pro', baseUrl = 'https://generativelanguage.googleapis.com/v1beta', providerName = 'gemini') {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`,
      name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} (${model})`,
      provider: 'gemini',
      maxTokens: 32768,
      supportedFeatures: ['chat', 'reasoning', 'multimodal'],
    }

    super(apiKey, baseUrl, aiModel)
    this.modelName = model
  }

  protected setupAuth(apiKey: string): void {
    // Gemini 的 auth 通过 URL query param 实现，此处为空
  }

  protected formatMessages(messages: Message[]): any[] {
    const userMessages = messages.filter((msg) => msg.role !== 'system')
    const contents: any[] = []
    if (userMessages.length === 0) {
      return contents
    }

    let currentRole: 'user' | 'model' | '' = ''
    let currentParts: any[] = []

    for (const msg of userMessages) {
      const role = msg.role === 'assistant' ? 'model' : 'user'

      if (role !== currentRole && currentParts.length > 0) {
        contents.push({ role: currentRole, parts: currentParts })
        currentParts = []
      }
      currentRole = role
      currentParts.push({ text: msg.content })
    }
    if (currentParts.length > 0) {
      contents.push({ role: currentRole, parts: currentParts })
    }
    return contents
  }

  protected parseResponse(response: any): string {
    return response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  protected parseStreamResponse(chunk: string): string | null {
    try {
      const parsed = JSON.parse(chunk)
      return parsed.candidates?.[0]?.content?.parts?.[0]?.text || null
    } catch {
      return null
    }
  }

  protected async makeRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const endpoint = `/models/${this.modelName}:generateContent?key=${this.apiKey}`
    const body = {
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    }

    const url = new URL(endpoint.replace(this.apiKey, '[REDACTED]'), this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', this.client.defaults.headers.common, body)}\n\n`)

    return this.client.post(endpoint, body)
  }

  protected async makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const endpoint = `/models/${this.modelName}:streamGenerateContent?key=${this.apiKey}`
    const body = {
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    }

    const url = new URL(endpoint.replace(this.apiKey, '[REDACTED]'), this.client.defaults.baseURL).href
    console.log(`\n\n${(this.constructor as any).generateCurlCommand(url, 'POST', this.client.defaults.headers.common, body)}\n\n`)

    return this.client.post(endpoint, body, { responseType: 'stream' })
  }
}
