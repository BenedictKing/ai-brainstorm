import { BaseAIProvider } from "./BaseAIProvider";
import { Message, AIModel } from "../types/index";

export class ClaudeProvider extends BaseAIProvider {
  private modelName: string;

  constructor(
    apiKey: string,
    model = "claude-4-sonnet",
    baseUrl = "https://api.anthropic.com/v1",
    providerName = "claude"
  ) {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`,
      name: `${
        providerName.charAt(0).toUpperCase() + providerName.slice(1)
      } (${model})`,
      provider: "claude",
      maxTokens: 200000,
      supportedFeatures: ["chat", "reasoning", "analysis", "code"],
    };

    super(apiKey, baseUrl, aiModel);
    this.modelName = model;
  }

  protected setupAuth(apiKey: string): void {
    this.client.defaults.headers.common["x-api-key"] = apiKey;
    this.client.defaults.headers.common["anthropic-version"] = "2023-06-01";
  }

  protected formatMessages(messages: Message[]): any[] {
    return messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
  }

  protected parseResponse(response: any): string {
    return response.content[0]?.text || "";
  }

  protected async makeRequest(messages: any[]): Promise<any> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    return this.client.post("/messages", {
      model: this.modelName,
      max_tokens: 2000,
      temperature: 0.7,
      system: systemMessage?.content || "",
      messages: userMessages,
    });
  }
}
