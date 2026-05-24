/**
 * OpenAI Compatible LLM Client
 */

import type { LLMClient, ChatRequest, ChatResponse } from "./types";

/**
 * OpenAI compatible client
 */
export class OpenAICompatibleClient implements LLMClient {
  constructor(private config: { baseUrl: string; apiKey: string; modelName: string }) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || this.config.modelName,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      content?: string;
    };

    const content = data.choices?.[0]?.message?.content ?? data.content ?? "";
    return { content };
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.chat({ messages: [{ role: "user", content: "ping" }] });
      return res.content.length > 0;
    } catch {
      return false;
    }
  }
}