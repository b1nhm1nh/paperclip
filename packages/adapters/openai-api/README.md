# OpenAI API Adapter

An OpenAI-compatible API adapter for Paperclip that enables agents to use any OpenAI-compatible LLM service, including:

- **Local LLM services** (daily-llm, Ollama, LM Studio, etc.)
- **Claude** via OpenAI-compatible proxy
- **Gemini** via OpenAI-compatible proxy
- **Any other LLM** with OpenAI-compatible `/v1/chat/completions` endpoint

## Quick Start

### Configuration

```json
{
  "baseUrl": "http://localhost:20128/v1",
  "model": "daily-llm",
  "temperature": 0.7,
  "maxTokens": 4096
}
```

### Parameters

- **baseUrl** (required): Base URL of the OpenAI-compatible API endpoint
  - Example: `http://localhost:20128/v1` or `https://api.openai.com/v1`
- **model** (required): Model ID to use
  - Example: `daily-llm`, `claude-opus-4-6`, `gpt-4o`
- **apiKey** (optional): API key if required by the service
  - Used as `Authorization: Bearer {apiKey}`
- **temperature** (optional, default 0.7): Sampling temperature (0-2)
  - Lower = more deterministic, Higher = more creative
- **maxTokens** (optional, default 4096): Maximum tokens in response
- **topP** (optional, default 1): Nucleus sampling parameter (0-1)
- **timeoutSec** (optional, default 300): Request timeout in seconds
- **promptTemplate**: Custom prompt template sent on each heartbeat
  - Variables: `{{agent.id}}`, `{{agent.name}}`, `{{runId}}`, `{{context}}`
- **bootstrapPromptTemplate**: Optional initial prompt for fresh sessions
- **env**: Environment variables (object format)

## Examples

### Local Daily LLM

```json
{
  "baseUrl": "http://localhost:20128/v1",
  "model": "daily-llm",
  "maxTokens": 8000,
  "temperature": 0.5
}
```

### Claude via OpenAI Proxy

```json
{
  "baseUrl": "https://api.openai.com/v1",
  "model": "claude-opus-4-6",
  "apiKey": "sk-...",
  "maxTokens": 8000
}
```

### Gemini via OpenAI Proxy

```json
{
  "baseUrl": "http://localhost:8000/v1",
  "model": "gemini-pro",
  "temperature": 0.7
}
```

## How It Works

1. Agent receives a task from Paperclip
2. Adapter builds a prompt with agent context and task description
3. Makes HTTP POST request to OpenAI-compatible endpoint at `/chat/completions`
4. Parses response and returns result to Paperclip
5. Agent logs usage and cost information

## Environment Testing

The adapter includes `testEnvironment()` which:
- Checks if `baseUrl` and `model` are configured
- Attempts to reach the OpenAI endpoint
- Validates API key configuration (if provided)
- Returns detailed diagnostics

## Limitations

- Sessions are not supported (no conversation history between heartbeats)
- Cost calculation is not performed for local LLMs
- Streaming responses are not yet implemented (full response only)

## Troubleshooting

### Endpoint not reachable

```
[openai-api] Error: Failed to call OpenAI API: fetch error
```

**Solution**: Verify `baseUrl` is correct and the service is running

### Model not found

```
[openai-api] Error: Failed to call OpenAI API: 404 Not Found
```

**Solution**: Verify `model` ID is correct for your service

### Authentication failed

```
[openai-api] Error: Failed to call OpenAI API: 401 Unauthorized
```

**Solution**: Check if `apiKey` is required and correctly configured

## Development

```bash
# Build the adapter
pnpm --filter @paperclipai/adapter-openai-api build

# Type check
pnpm --filter @paperclipai/adapter-openai-api typecheck

# The adapter is automatically registered when you run Paperclip
pnpm dev
```

## Testing with Daily LLM

To test with a local daily-llm instance:

```bash
# Start daily-llm (if you have it installed)
# It should run on http://localhost:20128/v1

# Then create an agent with:
pnpm paperclipai agent create \
  --name "My AI Agent" \
  --adapter-type openai_api \
  --config '{
    "baseUrl": "http://localhost:20128/v1",
    "model": "daily-llm"
  }'
```
