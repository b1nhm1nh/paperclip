# Testing the OpenAI API Adapter

## Quick Test with Daily LLM

### 1. Start your OpenAI-compatible LLM service

```bash
# If you have daily-llm or compatible service installed:
# It should listen on http://localhost:20128/v1
```

### 2. Verify the adapter is registered

Start Paperclip and check that `openai_api` adapter is available:

```bash
pnpm dev
# Then in another terminal:
curl http://localhost:3100/api/health
# Should return: {"status":"ok"}
```

### 3. Create an agent using the adapter

Via Paperclip UI:
1. Go to your company dashboard
2. Click "Hire Agent"
3. Select adapter: **OpenAI Compatible API**
4. Configure:
   - Base URL: `http://localhost:20128/v1`
   - Model: `daily-llm`
   - Temperature: `0.7`
   - Max Tokens: `4096`
5. Create agent

Or via CLI:

```bash
pnpm paperclipai agent create \
  --name "Daily LLM Agent" \
  --adapter-type openai_api \
  --adapter-config '{
    "baseUrl": "http://localhost:20128/v1",
    "model": "daily-llm",
    "temperature": 0.7,
    "maxTokens": 4096
  }'
```

### 4. Create a task for the agent

Via Paperclip UI or CLI:

```bash
pnpm paperclipai issue create \
  --title "Say hello" \
  --description "Hello, world! Introduce yourself."
```

### 5. Run the agent

```bash
# Via UI: Click "Assign" and then heartbeat trigger
# Or via CLI:
pnpm paperclipai agent heartbeat <agent-id> --issue-id <issue-id>
```

### 6. Check the response

The agent should:
1. Connect to your OpenAI-compatible endpoint
2. Send the task as a prompt
3. Receive a response
4. Log it back to Paperclip

## Testing with Different Models

### Claude (via OpenAI proxy)

```json
{
  "baseUrl": "http://localhost:8000/v1",
  "model": "claude-opus-4-6",
  "apiKey": "sk-...",
  "maxTokens": 8000
}
```

### Gemini (via proxy)

```json
{
  "baseUrl": "http://localhost:8000/v1",
  "model": "gemini-pro",
  "temperature": 0.7
}
```

### Ollama

```json
{
  "baseUrl": "http://localhost:11434/v1",
  "model": "llama2",
  "maxTokens": 2048
}
```

## Debugging

### View adapter logs

When an agent runs, check server logs for:
- `[openai-api] Sending request to {baseUrl}`
- `[openai-api] Received response`
- Any error messages

### Test environment

Check adapter health:

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
  "checks": [
    {
      "code": "base_url_configured",
      "level": "info",
      "message": "baseUrl configured: http://localhost:20128/v1"
    },
    {
      "code": "endpoint_reachable",
      "level": "info",
      "message": "OpenAI endpoint is reachable and responding"
    },
    {
      "code": "model_configured",
      "level": "info",
      "message": "Model configured: daily-llm"
    }
  ]
}
```

## Common Issues

### "Cannot reach OpenAI endpoint"

```
[openai-api] endpoint_unreachable: Cannot reach OpenAI endpoint
```

**Fix:**
1. Verify service is running on configured `baseUrl`
2. Check network connectivity
3. Try accessing endpoint directly:
   ```bash
   curl -X GET http://localhost:20128/v1/models
   ```

### "No response from API"

Service responded but didn't return valid data.

**Fix:**
1. Check model ID is correct
2. Verify API is returning valid OpenAI format responses
3. Check service logs for errors

### "API exited with code 1"

Generic API error.

**Fix:**
1. Check the full error message in logs
2. Try making a direct API call to test the endpoint
3. Verify configuration is correct

## Performance Tuning

### For faster responses:
```json
{
  "temperature": 0.1,
  "maxTokens": 2048
}
```

### For more creative responses:
```json
{
  "temperature": 1.0,
  "topP": 0.9
}
```

### For longer-running tasks:
```json
{
  "timeoutSec": 600,
  "maxTokens": 8192
}
```

## Integration Testing

Run with type checking:

```bash
pnpm -r typecheck
```

Run full build:

```bash
pnpm build
```

Run unit tests (when available):

```bash
pnpm test:run
```
