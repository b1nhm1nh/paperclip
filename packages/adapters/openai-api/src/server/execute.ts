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

    let rawResponse = "";
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    rawResponse = await response.text();

    if (!response.ok) {
      const errorData = (() => {
        try {
          return JSON.parse(rawResponse) as OpenAIErrorResponse;
        } catch {
          return null;
        }
      })();

      const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = JSON.parse(rawResponse) as OpenAIChatCompletionResponse;
    return { response: data, rawResponse };
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
  const maxTokens = asNumber(config.maxTokens, 4096);
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
