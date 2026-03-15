export interface OpenAIAPIFormValues {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  timeoutSec: number;
  promptTemplate: string;
  bootstrapPromptTemplate: string;
  envVars: string;
}

export function parseOpenAIAPIConfig(raw: Record<string, unknown>): OpenAIAPIFormValues {
  return {
    baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : "http://localhost:20128/v1",
    model: typeof raw.model === "string" ? raw.model : "daily-llm",
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
    temperature:
      typeof raw.temperature === "number" ? raw.temperature : 0.7,
    maxTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : 4096,
    topP: typeof raw.topP === "number" ? raw.topP : 1,
    timeoutSec: typeof raw.timeoutSec === "number" ? raw.timeoutSec : 300,
    promptTemplate:
      typeof raw.promptTemplate === "string"
        ? raw.promptTemplate
        : "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
    bootstrapPromptTemplate:
      typeof raw.bootstrapPromptTemplate === "string"
        ? raw.bootstrapPromptTemplate
        : "",
    envVars: typeof raw.env === "object" && raw.env !== null
      ? Object.entries(raw.env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n")
      : "",
  };
}

export function buildOpenAIAPIConfig(values: OpenAIAPIFormValues): Record<string, unknown> {
  const envLines = values.envVars.split("\n").filter((line) => line.trim().length > 0);
  const env: Record<string, string> = {};

  for (const line of envLines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0) {
      env[key] = rest.join("=");
    }
  }

  return {
    baseUrl: values.baseUrl,
    model: values.model,
    apiKey: values.apiKey || undefined,
    temperature: values.temperature,
    maxTokens: values.maxTokens,
    topP: values.topP,
    timeoutSec: values.timeoutSec,
    promptTemplate: values.promptTemplate,
    bootstrapPromptTemplate: values.bootstrapPromptTemplate,
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}
