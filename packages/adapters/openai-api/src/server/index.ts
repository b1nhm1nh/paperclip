import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterModel,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";

export { execute } from "./execute.js";

export const sessionCodec = {
  deserialize: () => null,
  serialize: () => null,
  getDisplayId: () => null,
};

export const models: AdapterModel[] = [
  { id: "daily-llm", label: "Daily LLM" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "gemini-pro", label: "Gemini Pro" },
];

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const { adapterType, config } = ctx;
  const checks = [];

  const baseUrl = asString(config.baseUrl, "");
  const model = asString(config.model, "");

  if (!baseUrl) {
    checks.push({
      code: "missing_base_url",
      level: "error" as const,
      message: "baseUrl is not configured",
      hint: "Configure baseUrl (e.g., http://localhost:20128/v1)",
    });
  } else {
    checks.push({
      code: "base_url_configured",
      level: "info" as const,
      message: `baseUrl configured: ${baseUrl}`,
    });

    // Try to reach the endpoint
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeoutHandle);

      if (response.ok) {
        checks.push({
          code: "endpoint_reachable",
          level: "info" as const,
          message: `OpenAI endpoint is reachable and responding`,
        });
      } else {
        checks.push({
          code: "endpoint_error",
          level: "warn" as const,
          message: `OpenAI endpoint returned HTTP ${response.status}`,
          detail: `Status: ${response.statusText}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        code: "endpoint_unreachable",
        level: "error" as const,
        message: "Cannot reach OpenAI endpoint",
        detail: message,
        hint: "Ensure the OpenAI-compatible service is running and baseUrl is correct",
      });
    }
  }

  if (!model) {
    checks.push({
      code: "missing_model",
      level: "error" as const,
      message: "model is not configured",
      hint: "Configure model (e.g., daily-llm, claude-opus-4-6, gpt-4o)",
    });
  } else {
    checks.push({
      code: "model_configured",
      level: "info" as const,
      message: `Model configured: ${model}`,
    });
  }

  const apiKey = asString(config.apiKey, "");
  if (apiKey) {
    checks.push({
      code: "api_key_configured",
      level: "info" as const,
      message: "API key is configured",
    });
  } else {
    checks.push({
      code: "no_api_key",
      level: "info" as const,
      message: "No API key configured (may be required by some services)",
    });
  }

  const hasErrors = checks.some((c) => c.level === "error");
  const status = hasErrors ? "fail" : "pass";

  return {
    adapterType,
    status,
    checks,
    testedAt: new Date().toISOString(),
  };
}
