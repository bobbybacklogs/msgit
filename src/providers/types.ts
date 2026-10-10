export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  /** Undefined means "let the bridge pick": ModelHitch rotates to its own default. */
  model: string | undefined;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

/**
 * Everything above this line works with an LLM through this interface only.
 * ModelHitch is the first implementation, not the only possible one.
 */
export interface Provider {
  readonly id: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
  listModels(): Promise<string[]>;
}
