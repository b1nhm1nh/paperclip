import type { CLIAdapterModule } from "@paperclipai/adapter-utils";

export const formatStdoutEvent: CLIAdapterModule["formatStdoutEvent"] = (line, _debug) => {
  // For OpenAI API adapter, just print the output lines
  console.log(line);
};

const module: CLIAdapterModule = {
  type: "openai_api",
  formatStdoutEvent,
};

export default module;
