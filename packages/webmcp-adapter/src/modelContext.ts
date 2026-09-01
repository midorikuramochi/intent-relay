export type WebMCPToolArguments = Record<string, unknown>;

/**
 * Producer-side registration contract: the browser parses the consumer's JSON
 * input against the input schema and invokes `execute` with the parsed
 * argument object, mirroring `document.modelContext.registerTool`. The JSON
 * string boundary belongs to the consumer-side `executeTool` call only.
 */
export interface WebMCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  execute: (args: WebMCPToolArguments, context?: { signal?: AbortSignal }) => Promise<string>;
}

export interface ToolRegistrationOptions {
  exposedTo?: string[];
  signal?: AbortSignal;
}

export interface DiscoveredTool {
  name: string;
  description: string;
  origin: string;
  /** Serialized JSON schema text, matching the browser's getTools() shape. */
  inputSchema?: string;
}

export interface ModelContextPort {
  registerTool(tool: WebMCPToolDescriptor, options?: ToolRegistrationOptions): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<DiscoveredTool[]>;
  executeTool(
    tool: DiscoveredTool,
    input: string,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  addEventListener(type: "toolchange", listener: EventListener): void;
  removeEventListener(type: "toolchange", listener: EventListener): void;
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

export function isModelContextPort(candidate: unknown): candidate is ModelContextPort {
  if (candidate === null || typeof candidate !== "object") {
    return false;
  }
  const port = candidate as Record<string, unknown>;
  return (
    isFunction(port.registerTool) &&
    isFunction(port.getTools) &&
    isFunction(port.executeTool) &&
    isFunction(port.addEventListener) &&
    isFunction(port.removeEventListener)
  );
}

/**
 * Returns the browser-provided `document.modelContext` port, or null when the
 * browser does not support WebMCP. This never substitutes a fake or mock port;
 * callers must surface an explicit unsupported-browser state instead.
 */
export function getBrowserModelContextPort(doc: Document): ModelContextPort | null {
  const candidate = (doc as Document & { modelContext?: unknown }).modelContext;
  return isModelContextPort(candidate) ? candidate : null;
}
