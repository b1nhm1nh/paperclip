import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  parseObject,
  buildPaperclipEnv,
  redactEnvForLogs,
} from "@paperclipai/adapter-utils/server-utils";

interface OpenAIChatCompletionRequest {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{
    index: number;
    message?: { role: "assistant"; content: string };
    finish_reason: string | null;
  }>;
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * Parse an SSE streaming response into a single aggregated completion response.
 * SSE lines look like: `data: {"id":"...","choices":[{"delta":{"content":"..."}}]}`
 * The final line is `data: [DONE]`.
 */
function parseSSEResponse(raw: string, model: string): OpenAIChatCompletionResponse {
  const contentParts: string[] = [];
  let responseId = "";
  let responseModel = model;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let finishReason: string | null = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) continue;
    const payload = trimmed.slice(6); // strip "data: "
    if (payload === "[DONE]") break;

    try {
      const chunk = JSON.parse(payload);
      if (chunk.id) responseId = chunk.id;
      if (chunk.model) responseModel = chunk.model;
      if (chunk.usage) {
        totalPromptTokens = chunk.usage.prompt_tokens ?? totalPromptTokens;
        totalCompletionTokens = chunk.usage.completion_tokens ?? totalCompletionTokens;
      }
      const choice = chunk.choices?.[0];
      if (choice?.delta?.content) {
        contentParts.push(choice.delta.content);
      }
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }
    } catch {
      // skip unparseable lines
    }
  }

  return {
    id: responseId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: responseModel,
    usage:
      totalPromptTokens || totalCompletionTokens
        ? {
            prompt_tokens: totalPromptTokens,
            completion_tokens: totalCompletionTokens,
            total_tokens: totalPromptTokens + totalCompletionTokens,
          }
        : undefined,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: contentParts.join("") },
        finish_reason: finishReason,
      },
    ],
  };
}

async function callOpenAIAPI(
  baseUrl: string,
  request: OpenAIChatCompletionRequest,
  apiKey: string | null,
  timeoutMs: number,
  onLog: AdapterExecutionContext["onLog"],
): Promise<{ response: OpenAIChatCompletionResponse; rawResponse: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    await onLog("stderr", `[openai-api] POST ${url}\n`);
    await onLog("stderr", `[openai-api] Model: ${request.model}\n`);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    // Request streaming so we can log tokens as they arrive
    const body = { ...request, stream: true };

    const fetchResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      const errorData = (() => {
        try {
          return JSON.parse(errorBody) as OpenAIErrorResponse;
        } catch {
          return null;
        }
      })();
      const errorMessage = errorData?.error?.message || `HTTP ${fetchResponse.status}`;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const contentType = fetchResponse.headers.get("content-type") ?? "";

    // If server returned plain JSON despite stream:true, handle it
    if (contentType.includes("application/json")) {
      const rawResponse = await fetchResponse.text();
      const data = JSON.parse(rawResponse) as OpenAIChatCompletionResponse;
      return { response: data, rawResponse };
    }

    // Stream SSE response
    await onLog("stderr", `[openai-api] Streaming response...\n`);

    const rawResponse = await fetchResponse.text();
    const contentParts: string[] = [];
    let responseId = "";
    let responseModel = request.model;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let finishReason: string | null = null;

    for (const line of rawResponse.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") break;

      try {
        const chunk = JSON.parse(payload);
        if (chunk.id) responseId = chunk.id;
        if (chunk.model) responseModel = chunk.model;
        if (chunk.usage) {
          totalPromptTokens = chunk.usage.prompt_tokens ?? totalPromptTokens;
          totalCompletionTokens = chunk.usage.completion_tokens ?? totalCompletionTokens;
        }
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content) {
          contentParts.push(choice.delta.content);
          // Stream content to stdout log so the UI can show real-time output
          await onLog("stdout", choice.delta.content);
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
      } catch {
        // skip unparseable lines
      }
    }

    const assembled: OpenAIChatCompletionResponse = {
      id: responseId,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: responseModel,
      usage:
        totalPromptTokens || totalCompletionTokens
          ? {
              prompt_tokens: totalPromptTokens,
              completion_tokens: totalCompletionTokens,
              total_tokens: totalPromptTokens + totalCompletionTokens,
            }
          : undefined,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: contentParts.join("") },
          finish_reason: finishReason,
        },
      ],
    };

    return { response: assembled, rawResponse };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to call OpenAI API: ${message}`);
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;

  const baseUrl = asString(config.baseUrl, "http://localhost:20128/v1");
  const model = asString(config.model, "daily-llm");
  const apiKey = asString(config.apiKey, "").trim() || null;
  const temperature = asNumber(config.temperature, 0.7);
  const maxTokens = asNumber(config.maxTokens, 200000);
  const topP = asNumber(config.topP, 1);
  const timeoutSec = asNumber(config.timeoutSec, 300);
  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const bootstrapPromptTemplate = asString(config.bootstrapPromptTemplate, "");

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };

  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  // Build prompt
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };

  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const renderedBootstrapPrompt = bootstrapPromptTemplate.trim().length > 0
    ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
    : "";

  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();

  const userMessage = [
    renderedBootstrapPrompt,
    sessionHandoffNote,
    renderedPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");

  const promptMetrics = {
    promptChars: userMessage.length,
    bootstrapPromptChars: renderedBootstrapPrompt.length,
    sessionHandoffChars: sessionHandoffNote.length,
    heartbeatPromptChars: renderedPrompt.length,
  };

  const openaiRequest: OpenAIChatCompletionRequest = {
    model,
    messages: [
      {
        role: "system",
        content: "You are an AI agent working on tasks. Be concise and actionable.",
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    temperature,
    max_tokens: maxTokens,
    top_p: topP,
  };

  if (onMeta) {
    await onMeta({
      adapterType: "openai_api",
      command: "POST",
      cwd: "",
      commandArgs: [baseUrl],
      env: redactEnvForLogs(env),
      prompt: userMessage,
      promptMetrics,
      context,
    });
  }

  const timeoutMs = timeoutSec * 1000;

  try {
    await onLog("stderr", `[openai-api] Sending request to ${baseUrl}\n`);

    const { response } = await callOpenAIAPI(baseUrl, openaiRequest, apiKey, timeoutMs, onLog);

    const choice = response.choices[0];
    if (!choice || !choice.message) {
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "No response from API",
        errorCode: "no_response",
        resultJson: response as unknown as Record<string, unknown>,
      };
    }

    const summary = choice.message.content;
    const usage = response.usage
      ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      }
      : undefined;

    await onLog("stderr", `[openai-api] Received response (${usage?.outputTokens || 0} output tokens)\n`);

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      provider: "openai",
      model,
      billingType: "api",
      costUsd: 0, // Not calculated for local LLMs
      usage,
      summary,
      resultJson: { response } as unknown as Record<string, unknown>,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await onLog("stderr", `[openai-api] Error: ${message}\n`);

    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: message,
      errorCode: "api_error",
    };
  }
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(.+?)\}\}/g, (match, path) => {
    const keys = path.split(".");
    let value: unknown = data;

    for (const key of keys) {
      if (value !== null && typeof value === "object") {
        value = (value as Record<string, unknown>)[key];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === null || value === undefined) {
      return match;
    }

    return String(value);
  });
}
