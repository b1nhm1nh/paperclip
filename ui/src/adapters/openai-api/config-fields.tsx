import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  DraftNumberInput,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function OpenAIAPIConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="Base URL" hint="OpenAI-compatible API endpoint (e.g. http://localhost:20128/v1)">
        {isCreate ? (
          <input
            type="text"
            className={inputClass}
            value={values!.url ?? "http://localhost:20128/v1"}
            onChange={(e) => set!({ url: e.target.value })}
            placeholder="http://localhost:20128/v1"
          />
        ) : (
          <DraftInput
            value={eff("adapterConfig", "baseUrl", String(config.baseUrl ?? "http://localhost:20128/v1"))}
            onCommit={(v) => mark("adapterConfig", "baseUrl", v)}
            immediate
            className={inputClass}
            placeholder="http://localhost:20128/v1"
          />
        )}
      </Field>

      <Field label="API Key" hint="Optional API key for authentication">
        {isCreate ? (
          <input
            type="password"
            className={inputClass}
            value={values!.envVars ?? ""}
            onChange={(e) => set!({ envVars: e.target.value })}
            placeholder="sk-... (leave empty if not required)"
          />
        ) : (
          <DraftInput
            value={eff("adapterConfig", "apiKey", String(config.apiKey ?? ""))}
            onCommit={(v) => mark("adapterConfig", "apiKey", v || undefined)}
            immediate
            className={inputClass}
            placeholder="sk-... (leave empty if not required)"
          />
        )}
      </Field>

      <Field label="Temperature" hint="Sampling temperature (0-2), lower = more deterministic">
        {isCreate ? (
          <input
            type="number"
            className={inputClass}
            value={0.7}
            min={0}
            max={2}
            step={0.1}
            onChange={() => {}}
          />
        ) : (
          <DraftNumberInput
            value={eff("adapterConfig", "temperature", Number(config.temperature ?? 0.7))}
            onCommit={(v) => mark("adapterConfig", "temperature", v)}
            immediate
            className={inputClass}
          />
        )}
      </Field>

      <Field label="Max Tokens" hint="Maximum tokens in response">
        {isCreate ? (
          <input
            type="number"
            className={inputClass}
            value={4096}
            min={1}
            step={100}
            onChange={() => {}}
          />
        ) : (
          <DraftNumberInput
            value={eff("adapterConfig", "maxTokens", Number(config.maxTokens ?? 4096))}
            onCommit={(v) => mark("adapterConfig", "maxTokens", v)}
            immediate
            className={inputClass}
          />
        )}
      </Field>
    </>
  );
}
