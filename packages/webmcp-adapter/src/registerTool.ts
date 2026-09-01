import type {
  ModelContextPort,
  ToolRegistrationOptions,
  WebMCPToolDescriptor,
} from "./modelContext";

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export async function registerTypedTool(
  port: ModelContextPort,
  descriptor: WebMCPToolDescriptor,
  options: ToolRegistrationOptions = {},
): Promise<void> {
  if (!TOOL_NAME_PATTERN.test(descriptor.name)) {
    throw new Error(
      `Invalid tool name "${descriptor.name}": use lowercase letters, digits, and underscores`,
    );
  }
  if (descriptor.description.trim() === "") {
    throw new Error(`Tool "${descriptor.name}" requires a non-empty description`);
  }
  if (options.signal?.aborted) {
    return;
  }
  await port.registerTool(descriptor, options);
}
