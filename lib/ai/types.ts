/**
 * AI Module Types
 */

/**
 * LLM Chat message
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * LLM Chat request
 */
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
}

/**
 * LLM Chat response
 */
export interface ChatResponse {
  content: string;
  finishReason?: string;
}

/**
 * LLM Client interface
 */
export interface LLMClient {
  chat(request: ChatRequest): Promise<ChatResponse>;
  ping(): Promise<boolean>;
}