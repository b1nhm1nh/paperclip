export const type = "openai_api";
export const label = "OpenAI Compatible API";

export const models = [
  { id: "daily-llm", label: "Daily LLM" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "gemini-pro", label: "Gemini Pro" },
];

export const agentConfigurationDoc = `# openai_api agent configuration

Adapter: openai_api

This adapter calls OpenAI-compatible APIs, supporting:
- Local LLM services (daily-llm, Ollama, etc.)
- Claude via OpenAI-compatible proxy
- Gemini via OpenAI-compatible proxy
- Any service with OpenAI-compatible /v1/chat/completions endpoint

Core fields:
- baseUrl (string, required): Base URL of the OpenAI-compatible API endpoint (e.g., http://localhost:20128/v1)
- model (string, required): Model ID to use (e.g., daily-llm, claude-opus-4-6, gpt-4o)
- apiKey (string, optional): API key if required by the service
- temperature (number, optional): Sampling temperature (0-2), defaults to 0.7
- maxTokens (number, optional): Maximum tokens in response, defaults to 4096
- topP (number, optional): Top-P sampling (0-1), defaults to 1
- promptTemplate (string, optional): Prompt template for agent context
- bootstrapPromptTemplate (string, optional): Bootstrap prompt for fresh sessions

Operational fields:
- timeoutSec (number, optional): Request timeout in seconds, defaults to 300
- retries (number, optional): Number of retries on failure, defaults to 3
- env (object, optional): KEY=VALUE environment variables

Examples:
\`\`\`json
{
  "baseUrl": "http://localhost:20128/v1",
  "model": "daily-llm",
  "maxTokens": 8000,
  "temperature": 0.5
}
\`\`\`

Or with Claude through OpenAI proxy:
\`\`\`json
{
  "baseUrl": "http://localhost:20128/v1",
  "model": "claude-opus-4-6",
  "apiKey": "sk-..."
}
\`\`\`
`;
