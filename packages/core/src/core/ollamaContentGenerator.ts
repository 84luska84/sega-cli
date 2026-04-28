/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modified by: sega-cli contributors
 * Modification: Added Ollama local model support via OpenAI-compatible API
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import type {
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensResponse,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  FunctionCall,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';
import type { LlmRole } from '../telemetry/llmRole.js';
import type { UserTierId, GeminiUserTier } from '../code_assist/types.js';

// ─── Types for Ollama OpenAI-Compatible API ─────────────────────────────────

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OllamaToolCall[];
  tool_call_id?: string;
}

interface OllamaToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

interface OllamaChatCompletionChoice {
  index: number;
  message: OllamaChatMessage;
  finish_reason: string | null;
}

interface OllamaChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OllamaChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OllamaChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

// ─── Ollama Model List ──────────────────────────────────────────────────────

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  details: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Lists all available models from the local Ollama instance.
 */
export async function listOllamaModels(
  baseUrl: string = 'http://localhost:11434',
): Promise<OllamaModel[]> {
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(
      `Failed to list Ollama models: ${response.status} ${response.statusText}`,
    );
  }
  const data = (await response.json()) as OllamaTagsResponse;
  return data.models;
}

/**
 * Converts Gemini-format Content[] to OpenAI-format messages[].
 */
function convertContentsToMessages(
  contents: Content[],
  systemInstruction?: string | Part | Part[] | Content,
): OllamaChatMessage[] {
  const messages: OllamaChatMessage[] = [];

  // Add system instruction if provided
  if (systemInstruction) {
    let sysText = '';
    if (typeof systemInstruction === 'string') {
      sysText = systemInstruction;
    } else if (Array.isArray(systemInstruction)) {
      sysText = systemInstruction
        .map((p) => (typeof p === 'string' ? p : p.text || ''))
        .join('\n');
    } else if ('parts' in systemInstruction) {
      sysText =
        systemInstruction.parts?.map((p) => p.text || '').join('\n') || '';
    } else if ('text' in systemInstruction) {
      sysText = systemInstruction.text || '';
    }
    if (sysText) {
      messages.push({ role: 'system', content: sysText });
    }
  }

  for (const content of contents) {
    if (content.role === 'user') {
      // Check if this is a function response
      const functionResponses = content.parts?.filter(
        (p) => p.functionResponse,
      );
      if (functionResponses && functionResponses.length > 0) {
        for (const fr of functionResponses) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(fr.functionResponse?.response || {}),
            tool_call_id: fr.functionResponse?.name || 'unknown',
          });
        }
      } else {
        const textParts = content.parts
          ?.filter((p) => p.text !== undefined)
          .map((p) => p.text!)
          .join('\n');
        if (textParts) {
          messages.push({ role: 'user', content: textParts });
        }
      }
    } else if (content.role === 'model') {
      const functionCalls = content.parts?.filter((p) => p.functionCall);
      const textParts = content.parts
        ?.filter((p) => p.text !== undefined && p.text !== '' && !p.thought)
        .map((p) => p.text!)
        .join('');

      if (functionCalls && functionCalls.length > 0) {
        const toolCalls: OllamaToolCall[] = functionCalls.map((fc, idx) => ({
          id: fc.functionCall!.name || `call_${idx}`,
          type: 'function' as const,
          function: {
            name: fc.functionCall!.name || '',
            arguments: JSON.stringify(fc.functionCall!.args || {}),
          },
        }));
        messages.push({
          role: 'assistant',
          content: textParts || null,
          tool_calls: toolCalls,
        });
      } else {
        messages.push({
          role: 'assistant',
          content: textParts || '',
        });
      }
    }
  }

  return messages;
}

/**
 * Converts Gemini tool declarations to OpenAI-format tool definitions.
 */
function convertToolsToOllama(
  tools?: Array<{
    functionDeclarations?: Array<{
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    }>;
  }>,
): OllamaToolDefinition[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  const ollamaTools: OllamaToolDefinition[] = [];
  for (const tool of tools) {
    if (tool.functionDeclarations) {
      for (const fd of tool.functionDeclarations) {
        ollamaTools.push({
          type: 'function',
          function: {
            name: fd.name,
            description: fd.description,
            parameters: fd.parameters,
          },
        });
      }
    }
  }
  return ollamaTools.length > 0 ? ollamaTools : undefined;
}

/**
 * Converts an Ollama chat completion response to Gemini-format GenerateContentResponse.
 */
function convertOllamaResponseToGemini(
  response: OllamaChatCompletionResponse,
): GenerateContentResponse {
  const choice = response.choices[0];
  if (!choice) {
    return {
      candidates: [],
      usageMetadata: response.usage
        ? {
            promptTokenCount: response.usage.prompt_tokens,
            candidatesTokenCount: response.usage.completion_tokens,
            totalTokenCount: response.usage.total_tokens,
          }
        : undefined,
    } as unknown as GenerateContentResponse;
  }

  const parts: Part[] = [];

  // Add text content
  if (choice.message.content) {
    parts.push({ text: choice.message.content });
  }

  // Add function calls
  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }
      parts.push({
        functionCall: {
          name: tc.function.name,
          args,
        } as FunctionCall,
      });
    }
  }

  // If no parts, add empty text
  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  const finishReasonMap: Record<string, string> = {
    stop: 'STOP',
    tool_calls: 'STOP',
    length: 'MAX_TOKENS',
    content_filter: 'SAFETY',
  };

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts,
        },
        finishReason: finishReasonMap[choice.finish_reason || 'stop'] || 'STOP',
      },
    ],
    usageMetadata: response.usage
      ? {
          promptTokenCount: response.usage.prompt_tokens,
          candidatesTokenCount: response.usage.completion_tokens,
          totalTokenCount: response.usage.total_tokens,
        }
      : undefined,
  } as unknown as GenerateContentResponse;
}

// ─── OllamaContentGenerator ────────────────────────────────────────────────

/**
 * ContentGenerator implementation that routes requests to a local Ollama instance
 * using its OpenAI-compatible API endpoint.
 */
export class OllamaContentGenerator implements ContentGenerator {
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  userTier?: UserTierId;
  userTierName?: string;
  paidTier?: GeminiUserTier;

  constructor(baseUrl: string, defaultModel: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultModel = defaultModel;
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
    _role: LlmRole,
  ): Promise<GenerateContentResponse> {
    const model = this.defaultModel; // Always use the configured Ollama model
    const messages = convertContentsToMessages(
      request.contents as Content[],
      request.config?.systemInstruction as
        | string
        | Part
        | Part[]
        | Content
        | undefined,
    );
    const tools = convertToolsToOllama(
      request.config?.tools as Array<{
        functionDeclarations?: Array<{
          name: string;
          description?: string;
          parameters?: Record<string, unknown>;
        }>;
      }>,
    );

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    if (tools && tools.length > 0) {
      body['tools'] = tools;
    }

    if (request.config?.temperature !== undefined) {
      body['temperature'] = request.config.temperature;
    }
    if (request.config?.topP !== undefined) {
      body['top_p'] = request.config.topP;
    }
    if (request.config?.maxOutputTokens !== undefined) {
      body['max_tokens'] = request.config.maxOutputTokens;
    }
    if (request.config?.stopSequences) {
      body['stop'] = request.config.stopSequences;
    }

    // If JSON mode is requested
    if (request.config?.responseMimeType === 'application/json') {
      body['response_format'] = { type: 'json_object' };
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.config?.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OllamaChatCompletionResponse;
    return convertOllamaResponseToGemini(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
    _role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const model = this.defaultModel; // Always use the configured Ollama model
    const messages = convertContentsToMessages(
      request.contents as Content[],
      request.config?.systemInstruction as
        | string
        | Part
        | Part[]
        | Content
        | undefined,
    );
    const tools = convertToolsToOllama(
      request.config?.tools as Array<{
        functionDeclarations?: Array<{
          name: string;
          description?: string;
          parameters?: Record<string, unknown>;
        }>;
      }>,
    );

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      body['tools'] = tools;
    }

    if (request.config?.temperature !== undefined) {
      body['temperature'] = request.config.temperature;
    }
    if (request.config?.topP !== undefined) {
      body['top_p'] = request.config.topP;
    }
    if (request.config?.maxOutputTokens !== undefined) {
      body['max_tokens'] = request.config.maxOutputTokens;
    }
    if (request.config?.stopSequences) {
      body['stop'] = request.config.stopSequences;
    }

    if (request.config?.responseMimeType === 'application/json') {
      body['response_format'] = { type: 'json_object' };
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.config?.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama API streaming error (${response.status}): ${errorText}`,
      );
    }

    async function* streamGenerator(): AsyncGenerator<GenerateContentResponse> {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Accumulate tool calls across chunks
      const accumulatedToolCalls: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map();
      let lastTextContent = '';
      let hasEmittedToolCalls = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              // If we have accumulated tool calls, emit them now
              if (accumulatedToolCalls.size > 0 && !hasEmittedToolCalls) {
                const parts: Part[] = [];
                if (lastTextContent) {
                  parts.push({ text: lastTextContent });
                }
                for (const [, tc] of accumulatedToolCalls) {
                  let args: Record<string, unknown> = {};
                  try {
                    args = JSON.parse(tc.arguments) as Record<string, unknown>;
                  } catch {
                    args = {};
                  }
                  parts.push({
                    functionCall: {
                      name: tc.name,
                      args,
                    } as FunctionCall,
                  });
                }
                yield {
                  candidates: [
                    {
                      content: { role: 'model', parts },
                      finishReason: 'STOP',
                    },
                  ],
                } as unknown as GenerateContentResponse;
                hasEmittedToolCalls = true;
              }
              continue;
            }

            let chunk: OllamaChatCompletionChunk;
            try {
              chunk = JSON.parse(data) as OllamaChatCompletionChunk;
            } catch {
              continue;
            }

            const choice = chunk.choices?.[0];
            if (!choice) continue;

            // Accumulate tool calls
            if (choice.delta.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const existing = accumulatedToolCalls.get(tc.index);
                if (existing) {
                  if (tc.function?.arguments) {
                    existing.arguments += tc.function.arguments;
                  }
                } else {
                  accumulatedToolCalls.set(tc.index, {
                    id: tc.id || `call_${tc.index}`,
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  });
                }
              }
              continue; // Don't emit until we have the full tool call
            }

            // Regular text content
            if (choice.delta.content) {
              lastTextContent += choice.delta.content;
              const parts: Part[] = [{ text: choice.delta.content }];
              const finishReason =
                choice.finish_reason === 'stop' ? 'STOP' : undefined;

              yield {
                candidates: [
                  {
                    content: { role: 'model', parts },
                    ...(finishReason && { finishReason }),
                  },
                ],
              } as unknown as GenerateContentResponse;
            } else if (
              choice.finish_reason &&
              accumulatedToolCalls.size === 0
            ) {
              // Final chunk with no content and no tool calls
              yield {
                candidates: [
                  {
                    content: { role: 'model', parts: [{ text: '' }] },
                    finishReason: 'STOP',
                  },
                ],
              } as unknown as GenerateContentResponse;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return streamGenerator();
  }

  async countTokens(
    _request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Ollama doesn't have a direct countTokens API.
    // We estimate based on the average of ~4 chars per token.
    const contents = _request.contents;
    let totalChars = 0;

    if (Array.isArray(contents)) {
      for (const content of contents) {
        if (typeof content === 'string') {
          totalChars += content.length;
        } else if (
          content &&
          typeof content === 'object' &&
          'parts' in content
        ) {
          const c = content;
          for (const part of c.parts || []) {
            if (part.text) {
              totalChars += part.text.length;
            }
          }
        }
      }
    }

    const estimatedTokens = Math.ceil(totalChars / 4);
    return {
      totalTokens: estimatedTokens,
    } as CountTokensResponse;
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Ollama supports embeddings via /api/embeddings
    // For now, return a minimal response since embeddings are rarely used in CLI
    throw new Error(
      'Embedding is not yet supported with Ollama provider. ' +
        'This feature is used for advanced context search and is not required for basic CLI usage.',
    );
  }
}
