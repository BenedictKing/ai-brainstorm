import { BaseAIProvider } from "./BaseAIProvider.js";
import { Message, AIModel } from "../types/index.js";
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider extends BaseAIProvider {
  private modelName: string;
  private genAI: GoogleGenerativeAI;

  constructor(
    apiKey: string,
    model = "gemini-1.5-pro",
    baseUrl = "https://generativelanguage.googleapis.com/v1beta",
    providerName = "gemini"
  ) {
    const aiModel: AIModel = {
      id: `${providerName}-${model}`,
      name: `${
        providerName.charAt(0).toUpperCase() + providerName.slice(1)
      } (${model})`,
      provider: "gemini",
      maxTokens: 32768,
      supportedFeatures: ["chat", "reasoning", "multimodal"],
    };

    super(apiKey, baseUrl, aiModel);
    this.modelName = model;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  protected setupAuth(apiKey: string): void {
    // SDK handles auth automatically
  }

  protected formatMessages(messages: Message[]): any[] {
    const contents = [];
    let currentRole = "";
    let currentParts: any[] = [];

    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";

      if (role !== currentRole && currentParts.length > 0) {
        contents.push({
          role: currentRole,
          parts: currentParts,
        });
        currentParts = [];
      }

      currentRole = role;
      currentParts.push({ text: msg.content });
    }

    if (currentParts.length > 0) {
      contents.push({
        role: currentRole,
        parts: currentParts,
      });
    }

    return contents;
  }

  protected parseResponse(response: any): string {
    return response.candidates[0]?.content?.parts[0]?.text || "";
  }

  protected parseStreamResponse(chunk: string): string | null {
    try {
      const parsed = JSON.parse(chunk);
      return parsed.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch {
      return null;
    }
  }

  protected async makeRequest(messages: any[]): Promise<any> {
    const model = this.genAI.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
    });

    // 提取system message和转换消息格式
    const systemMessage = messages.find((m: any) => m.role === "system");
    const userMessages = messages.filter((m: any) => m.role !== "system");
    
    // 构建聊天历史
    const history = [];
    let lastRole = "";
    
    for (const msg of userMessages) {
      const role = msg.role === "assistant" ? "model" : "user";
      if (role === lastRole) {
        // 如果连续相同角色，合并消息
        history[history.length - 1].parts.push({ text: msg.content });
      } else {
        history.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      }
      lastRole = role;
    }

    const chat = model.startChat({
      history: history.slice(0, -1), // 除了最后一条消息
      systemInstruction: systemMessage?.content
    });

    const lastMessage = history[history.length - 1];
    const result = await chat.sendMessage(lastMessage?.parts[0]?.text || "");
    
    return { 
      data: {
        candidates: [{
          content: {
            parts: [{ text: result.response.text() }]
          }
        }]
      }
    };
  }

  protected async makeStreamRequest(messages: any[]): Promise<any> {
    const model = this.genAI.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
    });

    // 提取system message和转换消息格式
    const systemMessage = messages.find((m: any) => m.role === "system");
    const userMessages = messages.filter((m: any) => m.role !== "system");
    
    // 构建聊天历史
    const history = [];
    let lastRole = "";
    
    for (const msg of userMessages) {
      const role = msg.role === "assistant" ? "model" : "user";
      if (role === lastRole) {
        // 如果连续相同角色，合并消息
        history[history.length - 1].parts.push({ text: msg.content });
      } else {
        history.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      }
      lastRole = role;
    }

    const chat = model.startChat({
      history: history.slice(0, -1), // 除了最后一条消息
      systemInstruction: systemMessage?.content
    });

    const lastMessage = history[history.length - 1];
    const stream = await chat.sendMessageStream(lastMessage?.parts[0]?.text || "");
    
    return { data: stream.stream };
  }
}
