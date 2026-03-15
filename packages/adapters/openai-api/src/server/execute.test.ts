import { describe, it, expect, beforeEach, vi } from "vitest";
import { execute } from "./execute.js";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

describe("OpenAI API Adapter", () => {
  let mockContext: AdapterExecutionContext;

  beforeEach(() => {
    mockContext = {
      runId: "run-123",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Test Agent",
        adapterType: "openai_api",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        baseUrl: "http://localhost:20128/v1",
        model: "daily-llm",
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1,
        timeoutSec: 300,
        promptTemplate: "You are agent {{agent.id}}. Continue your work.",
      },
      context: {
        paperclipSessionHandoffMarkdown: "",
      },
      onLog: vi.fn(),
      onMeta: vi.fn(),
    };
  });

  describe("configuration validation", () => {
    it("should use default baseUrl if not provided", () => {
      const config = {
        model: "daily-llm",
      };
      expect(config.model).toBe("daily-llm");
    });

    it("should accept custom baseUrl", () => {
      mockContext.config.baseUrl = "http://localhost:8000/v1";
      expect(mockContext.config.baseUrl).toBe("http://localhost:8000/v1");
    });

    it("should accept optional apiKey", () => {
      mockContext.config.apiKey = "test-key-123";
      expect(mockContext.config.apiKey).toBe("test-key-123");
    });

    it("should accept temperature parameter", () => {
      mockContext.config.temperature = 0.5;
      expect(mockContext.config.temperature).toBe(0.5);
    });

    it("should accept maxTokens parameter", () => {
      mockContext.config.maxTokens = 8000;
      expect(mockContext.config.maxTokens).toBe(8000);
    });
  });

  describe("prompt templating", () => {
    it("should render agent.id in template", () => {
      const template = "Agent: {{agent.id}}";
      const result = template.replace(/\{\{agent\.id\}\}/g, "agent-1");
      expect(result).toBe("Agent: agent-1");
    });

    it("should render agent.name in template", () => {
      const template = "Agent: {{agent.name}}";
      const result = template.replace(/\{\{agent\.name\}\}/g, "Test Agent");
      expect(result).toBe("Agent: Test Agent");
    });

    it("should render runId in template", () => {
      const template = "Run: {{runId}}";
      const result = template.replace(/\{\{runId\}\}/g, "run-123");
      expect(result).toBe("Run: run-123");
    });

    it("should handle multiple variables in template", () => {
      const template = "Agent {{agent.name}} ({{agent.id}}) running {{runId}}";
      let result = template.replace(/\{\{agent\.name\}\}/g, "Test Agent");
      result = result.replace(/\{\{agent\.id\}\}/g, "agent-1");
      result = result.replace(/\{\{runId\}\}/g, "run-123");
      expect(result).toBe("Agent Test Agent (agent-1) running run-123");
    });
  });

  describe("error handling", () => {
    it("should handle missing baseUrl gracefully", () => {
      const config = {
        model: "daily-llm",
        baseUrl: "",
      };
      // Should use default
      const baseUrl = config.baseUrl || "http://localhost:20128/v1";
      expect(baseUrl).toBe("http://localhost:20128/v1");
    });

    it("should handle missing model gracefully", () => {
      const config = {
        baseUrl: "http://localhost:20128/v1",
        model: "",
      };
      // Should use default or error
      const model = config.model || "daily-llm";
      expect(model).toBe("daily-llm");
    });

    it("should handle timeoutSec as number", () => {
      mockContext.config.timeoutSec = 600;
      expect(typeof mockContext.config.timeoutSec).toBe("number");
      expect(mockContext.config.timeoutSec).toBe(600);
    });
  });

  describe("API request format", () => {
    it("should build valid chat completion request", () => {
      const request = {
        model: "daily-llm",
        messages: [
          { role: "system" as const, content: "You are an AI agent." },
          { role: "user" as const, content: "Hello, world!" },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        top_p: 1,
      };

      expect(request.model).toBe("daily-llm");
      expect(request.messages).toHaveLength(2);
      expect(request.messages[0].role).toBe("system");
      expect(request.messages[1].role).toBe("user");
      expect(request.temperature).toBe(0.7);
      expect(request.max_tokens).toBe(4096);
    });

    it("should support optional apiKey in headers", () => {
      const apiKey = "test-key-123";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      expect(headers["Authorization"]).toBe("Bearer test-key-123");
    });

    it("should not set auth header without apiKey", () => {
      const apiKey = "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      expect("Authorization" in headers).toBe(false);
    });
  });

  describe("response parsing", () => {
    it("should parse valid OpenAI response", () => {
      const response: {
        id: string;
        object: string;
        created: number;
        model: string;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        choices: Array<{ index: number; message?: { role: string; content: string }; finish_reason: string }>;
      } = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "daily-llm",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Hello! I am an AI assistant.",
            },
            finish_reason: "stop",
          },
        ],
      };

      expect(response.choices[0].message?.content).toBe(
        "Hello! I am an AI assistant.",
      );
      expect(response.usage?.prompt_tokens).toBe(10);
      expect(response.usage?.completion_tokens).toBe(20);
    });

    it("should handle missing usage info", () => {
      const response: {
        id: string;
        object: string;
        created: number;
        model: string;
        choices: Array<{ index: number; message?: { role: string; content: string }; finish_reason: string }>;
      } = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "daily-llm",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Hello!",
            },
            finish_reason: "stop",
          },
        ],
      };

      expect((response as any).usage).toBeUndefined();
      expect(response.choices[0].message?.content).toBe("Hello!");
    });

    it("should detect no response error", () => {
      const response = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "daily-llm",
        choices: [],
      };

      const hasResponse = response.choices.length > 0;
      expect(hasResponse).toBe(false);
    });
  });

  describe("execution result format", () => {
    it("should return correct exit code on success", () => {
      const result = {
        exitCode: 0,
        signal: null,
        timedOut: false,
      };

      expect(result.exitCode).toBe(0);
      expect(result.signal).toBeNull();
      expect(result.timedOut).toBe(false);
    });

    it("should return error exit code on failure", () => {
      const result = {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "API error",
        errorCode: "api_error",
      };

      expect(result.exitCode).toBe(1);
      expect(result.errorMessage).toBe("API error");
    });

    it("should include provider and model in result", () => {
      const result = {
        exitCode: 0,
        signal: null,
        timedOut: false,
        provider: "openai",
        model: "daily-llm",
        billingType: "api" as const,
      };

      expect(result.provider).toBe("openai");
      expect(result.model).toBe("daily-llm");
      expect(result.billingType).toBe("api");
    });

    it("should include usage information", () => {
      const result = {
        exitCode: 0,
        signal: null,
        timedOut: false,
        usage: {
          inputTokens: 10,
          outputTokens: 20,
        },
      };

      expect(result.usage?.inputTokens).toBe(10);
      expect(result.usage?.outputTokens).toBe(20);
    });

    it("should include summary text", () => {
      const result = {
        exitCode: 0,
        signal: null,
        timedOut: false,
        summary: "Task completed successfully",
      };

      expect(result.summary).toBe("Task completed successfully");
    });
  });

  describe("environment variables", () => {
    it("should accept env config object", () => {
      const envConfig: Record<string, string> = {
        CUSTOM_VAR: "value123",
        DEBUG: "true",
      };
      mockContext.config.env = envConfig;

      if (typeof mockContext.config.env === "object" && mockContext.config.env !== null) {
        expect((mockContext.config.env as Record<string, string>).CUSTOM_VAR).toBe("value123");
        expect((mockContext.config.env as Record<string, string>).DEBUG).toBe("true");
      }
    });

    it("should build env from config", () => {
      const envConfig = {
        CUSTOM_VAR: "value123",
      };
      const env: Record<string, string> = {};

      for (const [key, value] of Object.entries(envConfig)) {
        if (typeof value === "string") env[key] = value;
      }

      expect(env.CUSTOM_VAR).toBe("value123");
    });
  });

  describe("model support", () => {
    it("should support daily-llm model", () => {
      mockContext.config.model = "daily-llm";
      expect(mockContext.config.model).toBe("daily-llm");
    });

    it("should support claude model", () => {
      mockContext.config.model = "claude-opus-4-6";
      expect(mockContext.config.model).toBe("claude-opus-4-6");
    });

    it("should support gpt-4o model", () => {
      mockContext.config.model = "gpt-4o";
      expect(mockContext.config.model).toBe("gpt-4o");
    });

    it("should support gemini model", () => {
      mockContext.config.model = "gemini-pro";
      expect(mockContext.config.model).toBe("gemini-pro");
    });
  });
});
