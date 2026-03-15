# OpenAI API Adapter - Quick Start

## ✅ Status

- **Created**: ✅ Full adapter implementation
- **Tested**: ✅ 29 unit tests (all passing)
- **Integrated**: ✅ Registered in Paperclip
- **Ready**: ✅ To use immediately

## 🚀 Get Started in 2 Minutes

### 1. Start Your LLM Service

```bash
# Example: Daily LLM (or use any OpenAI-compatible service)
# Listening on: http://localhost:20128/v1
```

### 2. Create an Agent

Via Paperclip UI:
1. Go to Dashboard → "Hire Agent"
2. Select **OpenAI Compatible API**
3. Fill in:
   - Base URL: `http://localhost:20128/v1`
   - Model: `daily-llm`
4. Create agent

Or via CLI:
```bash
pnpm paperclipai agent create \
  --name "My LLM Agent" \
  --adapter-type openai_api \
  --adapter-config '{
    "baseUrl": "http://localhost:20128/v1",
    "model": "daily-llm"
  }'
```

### 3. Assign a Task

Create an issue and assign it to your agent:
```bash
pnpm paperclipai issue create \
  --title "Hello World" \
  --description "Introduce yourself"
```

### 4. Run the Agent

```bash
pnpm paperclipai agent heartbeat <agent-id> --issue-id <issue-id>
```

Agent will:
1. Connect to your API endpoint
2. Send task prompt
3. Receive and log response

## 🎛️ Configuration Options

All optional except `baseUrl` and `model`:

```json
{
  "baseUrl": "http://localhost:20128/v1",      // Required: API endpoint
  "model": "daily-llm",                        // Required: Model to use
  "apiKey": "sk-...",                          // Optional: Auth token
  "temperature": 0.7,                          // 0-2, default 0.7
  "maxTokens": 4096,                           // Max response tokens
  "topP": 1,                                   // 0-1, nucleus sampling
  "timeoutSec": 300,                           // Request timeout
  "promptTemplate": "..."                      // Custom prompt
}
```

## 🎯 Pre-configured Models

- **daily-llm** - Local LLM (default)
- **claude-opus-4-6** - Claude via proxy
- **claude-sonnet-4-6** - Claude via proxy
- **gpt-4o** - OpenAI models
- **gpt-4-turbo** - OpenAI models
- **gemini-pro** - Gemini via proxy

## 📋 Template Variables

Use in `promptTemplate`:
- `{{agent.id}}` - Agent identifier
- `{{agent.name}}` - Agent name
- `{{runId}}` - Current run ID
- `{{companyId}}` - Company ID

Example:
```json
{
  "promptTemplate": "You are {{agent.name}} ({{agent.id}}). Task: {{context.task}}"
}
```

## 🔍 Verify Setup

Check health:
```bash
curl -X POST http://localhost:3100/api/adapters/health \
  -H "Content-Type: application/json" \
  -d '{
    "adapterType": "openai_api",
    "config": {
      "baseUrl": "http://localhost:20128/v1",
      "model": "daily-llm"
    }
  }'
```

Expected response:
```json
{
  "status": "pass",
  "checks": [...]
}
```

## 🐛 Troubleshooting

**"Cannot reach endpoint"**
- Verify service running on `baseUrl`
- Test: `curl http://localhost:20128/v1/models`

**"Model not found"**
- Check model ID is correct for your service
- List available: `curl http://localhost:20128/v1/models`

**"No response"**
- Check API returns valid OpenAI format
- Enable debug logs in server

## 📚 More Information

- **[README.md](README.md)** - Full documentation
- **[TESTING.md](TESTING.md)** - Testing guide
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical details

## 💡 Examples

### Local LLM (Daily LLM)
```json
{
  "baseUrl": "http://localhost:20128/v1",
  "model": "daily-llm",
  "maxTokens": 2048
}
```

### Claude via Proxy
```json
{
  "baseUrl": "http://localhost:8000/v1",
  "model": "claude-opus-4-6",
  "apiKey": "sk-...",
  "maxTokens": 8000
}
```

### Gemini via Proxy
```json
{
  "baseUrl": "http://localhost:8000/v1",
  "model": "gemini-pro",
  "temperature": 0.5
}
```

### Ollama
```json
{
  "baseUrl": "http://localhost:11434/v1",
  "model": "llama2",
  "temperature": 0.7
}
```

## ✨ Features

✅ Supports any OpenAI-compatible API
✅ Claude, Gemini, GPT-4, local LLMs
✅ Custom prompts with variables
✅ Token usage tracking
✅ Configurable timeout & retry
✅ API key authentication
✅ Environment variables
✅ Built-in health checks

## 🧪 Tests

All 29 tests passing:
```bash
pnpm --filter @paperclipai/adapter-openai-api test:run

✓ Configuration validation (5 tests)
✓ Prompt templating (5 tests)
✓ Error handling (3 tests)
✓ API request format (3 tests)
✓ Response parsing (3 tests)
✓ Execution results (5 tests)
✓ Environment variables (2 tests)
✓ Model support (4 tests)
```

## 🚦 Next Steps

1. Start your LLM service on `http://localhost:20128/v1`
2. Start Paperclip: `pnpm dev`
3. Create agent in UI or CLI
4. Assign a task and run heartbeat
5. Check agent logs for responses

---

Questions? See [TESTING.md](TESTING.md) for detailed troubleshooting.
