import { BaseAIProvider } from "./BaseAIProvider.js";
import { Message, AIModel } from "../types/index.js";
import OpenAI from 'openai';

export class GrokProvider extends BaseAIProvider {
  private grok: OpenAI;

  constructor(apiKey: string, model = "grok-beta") {
    const aiModel: AIModel = {
      id: "grok-beta",
      name: "Grok Beta",
      provider: "grok",
      maxTokens: 16384,
      supportedFeatures: ["chat", "reasoning", "humor", "real-time"],
    };

    super(apiKey, "https://api.x.ai/v1", aiModel);
    this.grok = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.x.ai/v1",
    });
  }

  protected setupAuth(apiKey: string): void {
    // SDK handles auth automatically
  }

  protected formatMessages(messages: Message[]): any[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  protected parseResponse(response: any): string {
    return response.choices[0]?.message?.content || "";
  }

  protected parseStreamResponse(chunk: string): string | null {
    try {
      const parsed = JSON.parse(chunk);
      return parsed.choices?.[0]?.delta?.content || null;
    } catch {
      return null;
    }
  }

  protected async makeRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const finalMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;

    const completion = await this.grok.chat.completions.create({
      model: "grok-beta",
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: false,
    });

    return { data: completion };
  }

  protected async makeStreamRequest(messages: any[], systemPrompt?: string): Promise<any> {
    const finalMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;

    const stream = await this.grok.chat.completions.create({
      model: "grok-beta",
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    });

    return { data: stream };
  }
}
