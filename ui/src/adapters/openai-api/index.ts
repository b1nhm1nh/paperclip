import type { UIAdapterModule, TranscriptEntry } from "../types";
import { OpenAIAPIConfigFields } from "./config-fields";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";

function parseOpenAIStdoutLine(line: string, ts: string): TranscriptEntry[] {
  // OpenAI API adapter outputs plain text lines
  if (!line.trim()) return [];
  return [{ kind: "stdout", ts, text: line }];
}

function buildOpenAIAPIConfig(values: CreateConfigValues): Record<string, unknown> {
  return {
    baseUrl: values.url || "http://localhost:20128/v1",
    model: values.model || "daily-llm",
    ...(values.args?.trim() ? { apiKey: values.args.trim() } : {}),
    temperature: 0.7,
    maxTokens: 4096,
    promptTemplate: values.promptTemplate || "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  };
}

export const openaiApiUIAdapter: UIAdapterModule = {
  type: "openai_api",
  label: "OpenAI Compatible API",
  parseStdoutLine: parseOpenAIStdoutLine,
  ConfigFields: OpenAIAPIConfigFields,
  buildAdapterConfig: buildOpenAIAPIConfig,
};
