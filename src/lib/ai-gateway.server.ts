import { createOpenAI } from "@ai-sdk/openai";

/**
 * OpenAI provider factory. Read OPENAI_API_KEY inside a server
 * handler and pass it to this function.
 */
export function createOpenAIProvider(openaiApiKey: string) {
  return createOpenAI({
    apiKey: openaiApiKey,
  });
}
