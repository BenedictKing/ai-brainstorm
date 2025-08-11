export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'claude' | 'gemini' | 'grok';
  maxTokens: number;
  supportedFeatures: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  participants: AIParticipant[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'error';
  currentRound: number;
  maxRounds: number;
  tags?: string[];
}

export interface AIParticipant {
  id: string;
  roleId: string;
  name: string;
  role: string;
  model: AIModel;
  systemPrompt: string;
  isActive: boolean;
}

export interface DiscussionTopic {
  id: string;
  question: string;
  context?: string;
  participants: string[];
  expectedOutputFormat?: string;
}

export interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  source: string;
  tags: string[];
  createdAt: Date;
  relevanceScore?: number;
}

export interface ContextCompressionResult {
  compressedContent: string;
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  keyPoints: string[];
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}
