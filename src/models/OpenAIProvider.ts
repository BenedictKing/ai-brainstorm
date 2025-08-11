import { BaseAIProvider } from "./BaseAIProvider.js";
import { Message, AIModel } from "../types/index.js";
import OpenAI from "openai";

export class OpenAIProvider extends BaseAIProvider {
  private modelName: string;
  private openai: OpenAI;

  constructor(
    apiKey: string,
    model = "gpt-4o",
    baseUrl = "https://api.openai.com/v1",
    providerName = "openai"
  ) {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`,
      name: `${
        providerName.charAt(0).toUpperCase() + providerName.slice(1)
      } (${model})`,
      provider: "openai",
      maxTokens: 16384,
      supportedFeatures: ["chat", "reasoning", "code"],
    };

    super(apiKey, baseUrl, aiModel);
    this.modelName = model;
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl,
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

  protected async makeRequest(messages: any[]): Promise<any> {
    const completion = await this.openai.chat.completions.create({
      model: this.modelName,
      messages,
      temperature: 0.7,
      max_tokens: 16384,
    });

    return { data: completion };
  }

  protected async makeStreamRequest(messages: any[]): Promise<any> {
    const stream = await this.openai.chat.completions.create({
      model: this.modelName,
      messages,
      temperature: 0.7,
      max_tokens: 16384,
      stream: true,
    });

    return { data: stream };
  }
}
