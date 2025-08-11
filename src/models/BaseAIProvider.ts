import axios, { AxiosInstance } from 'axios'
import { Message, AIModel } from '../types/index.js'
import { withRetry, RetryConfig } from '../utils/retry.js'
import { config } from '../config/index.js'

export abstract class BaseAIProvider {
  protected client: AxiosInstance
  protected model: AIModel
  protected retryConfig: RetryConfig

  constructor(apiKey: string, baseUrl: string, model: AIModel) {
    this.model = model
    this.retryConfig = config.retry

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: config.aiRequest.timeout,
    })

    this.setupAuth(apiKey)
  }

  protected abstract setupAuth(apiKey: string): void
  protected abstract formatMessages(messages: Message[]): any[]
  protected abstract parseResponse(response: any): string
  protected abstract parseStreamResponse(chunk: string): string | null

  async generateResponse(messages: Message[], systemPrompt?: string): Promise<string> {
    const context = `${this.model.provider}-${this.model.name}`

    return await withRetry(
      async () => {
        // 移除在此处预置 system message 的逻辑
        const formattedMessages = this.formatMessages(messages)

        // 开发模式下输出请求内容
        if (process.env.NODE_ENV === 'development') {
          console.log(`\n🔵 [${this.model.provider}] Request:`, {
            model: this.model.name,
            systemPrompt: systemPrompt, // Log the separate system prompt
            messages: formattedMessages.map((m: any) => ({
              // Use any type for flexibility
              role: m.role,
              content: m.content.substring(0, 500) + (m.content.length > 500 ? '...' : ''),
            })),
          })
        }

        let response: any
        let parsedResponse: string

        try {
          // 首先尝试流式请求
          if (config.aiRequest.enableStreamFallback && process.env.NODE_ENV === 'development') {
            console.log(`\n📡 [${this.model.provider}] Trying streaming request...`)
          }

          // 将 systemPrompt 传递给 makeStreamRequest
          response = await this.makeStreamRequest(formattedMessages, systemPrompt)
          parsedResponse = await this.handleStreamResponse(response)

          if (process.env.NODE_ENV === 'development') {
            console.log(`\n✅ [${this.model.provider}] Streaming successful`)
          }
        } catch (streamError: any) {
          // 流式失败，回退到非流式（如果启用）
          if (config.aiRequest.enableStreamFallback) {
            if (process.env.NODE_ENV === 'development') {
              console.log(
                `\n⚠️  [${this.model.provider}] Streaming failed, falling back to non-streaming:`,
                streamError.message
              )
            }

            // 将 systemPrompt 传递给 makeRequest
            response = await this.makeRequest(formattedMessages, systemPrompt)
            parsedResponse = this.parseResponse(response.data)

            if (process.env.NODE_ENV === 'development') {
              console.log(`\n✅ [${this.model.provider}] Non-streaming successful`)
            }
          } else {
            throw streamError
          }
        }

        // 开发模式下输出回复内容
        if (process.env.NODE_ENV === 'development') {
          console.log(`\n🟢 [${this.model.provider}] Response:`, {
            content: parsedResponse.substring(0, 500) + (parsedResponse.length > 500 ? '...' : ''),
            fullLength: parsedResponse.length,
          })
        }

        // 验证响应不为空
        if (!parsedResponse || parsedResponse.trim().length === 0) {
          throw new Error(`Empty response from ${this.model.provider}`)
        }

        return parsedResponse
      },
      this.retryConfig,
      context
    )
  }

  private async handleStreamResponse(response: any): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let fullContent = ''

      try {
        // 检查是否是 OpenAI SDK 的流式响应 (AsyncIterable)
        if (response.data && Symbol.asyncIterator in response.data) {
          for await (const chunk of response.data) {
            // OpenAI format
            const openaiContent = chunk.choices?.[0]?.delta?.content
            // Anthropic format
            const anthropicContent = chunk.delta?.text
            // Gemini format
            const geminiContent = chunk.candidates?.[0]?.content?.parts?.[0]?.text || chunk.text?.()

            const content = openaiContent || anthropicContent || geminiContent
            if (content) {
              fullContent += content
            }
          }
          resolve(fullContent)
          return
        }

        // 传统的流式响应处理 (适用于自定义实现)
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk
            .toString()
            .split('\n')
            .filter((line) => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                resolve(fullContent)
                return
              }

              try {
                const parsed = this.parseStreamResponse(data)
                if (parsed) {
                  fullContent += parsed
                }
              } catch (e) {
                // 忽略解析错误，继续处理其他块
              }
            }
          }
        })

        response.data.on('end', () => {
          resolve(fullContent)
        })

        response.data.on('error', (error: any) => {
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  protected abstract makeRequest(messages: any[], systemPrompt?: string): Promise<any>
  protected abstract makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any>

  getModel(): AIModel {
    return this.model
  }
}
