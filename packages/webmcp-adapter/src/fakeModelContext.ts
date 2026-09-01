import type {
  DiscoveredTool,
  ModelContextPort,
  ToolRegistrationOptions,
  WebMCPToolDescriptor,
} from "./modelContext";

type RemoteHandler = (input: string, signal?: AbortSignal) => Promise<unknown>;

interface LocalRegistration {
  descriptor: WebMCPToolDescriptor;
  options: ToolRegistrationOptions;
}

interface RemoteRegistration {
  tool: DiscoveredTool;
  handler: RemoteHandler;
}

function remoteKey(origin: string, name: string): string {
  return `${origin} ${name}`;
}

/**
 * In-memory reference implementation of the ModelContextPort contract for
 * tests. Production code must never construct this; the browser port comes
 * from getBrowserModelContextPort only.
 *
 * It models both sides of the WebMCP boundary: executeTool accepts the
 * consumer's JSON string, while a locally registered descriptor's execute
 * callback is invoked with the parsed argument object.
 */
export class FakeModelContext implements ModelContextPort {
  ignoreFromOriginsFilter = false;
  lastGetToolsOptions: { fromOrigins?: string[] } | undefined;

  private readonly localTools = new Map<string, LocalRegistration>();
  private readonly remoteTools = new Map<string, RemoteRegistration>();
  private readonly listeners = new Set<EventListener>();

  constructor(private readonly origin: string = "http://localhost:4173") {}

  async registerTool(
    tool: WebMCPToolDescriptor,
    options: ToolRegistrationOptions = {},
  ): Promise<void> {
    if (options.signal?.aborted) {
      return;
    }
    this.localTools.set(tool.name, { descriptor: tool, options });
    options.signal?.addEventListener(
      "abort",
      () => {
        this.localTools.delete(tool.name);
        this.emitToolChange();
      },
      { once: true },
    );
    this.emitToolChange();
  }

  async getTools(options?: { fromOrigins?: string[] }): Promise<DiscoveredTool[]> {
    this.lastGetToolsOptions = options;
    const all: DiscoveredTool[] = [
      ...[...this.localTools.values()].map(({ descriptor }) => ({
        name: descriptor.name,
        description: descriptor.description,
        origin: this.origin,
        inputSchema: JSON.stringify(descriptor.inputSchema),
      })),
      ...[...this.remoteTools.values()].map(({ tool }) => ({ ...tool })),
    ];
    if (options?.fromOrigins === undefined || this.ignoreFromOriginsFilter) {
      return all;
    }
    const allowed = new Set(options.fromOrigins);
    return all.filter((tool) => allowed.has(tool.origin));
  }

  async executeTool(
    tool: DiscoveredTool,
    input: string,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const remote = this.remoteTools.get(remoteKey(tool.origin, tool.name));
    if (remote !== undefined) {
      return remote.handler(input, options?.signal);
    }
    const local = this.localTools.get(tool.name);
    if (local !== undefined) {
      let args: unknown;
      try {
        args = JSON.parse(input);
      } catch {
        throw new TypeError(`Tool "${tool.name}" received input that is not valid JSON`);
      }
      if (args === null || typeof args !== "object" || Array.isArray(args)) {
        throw new TypeError(`Tool "${tool.name}" received input that is not an argument object`);
      }
      return local.descriptor.execute(args as Record<string, unknown>, {
        signal: options?.signal,
      });
    }
    throw new Error(`FakeModelContext has no tool "${tool.name}" at ${tool.origin}`);
  }

  addEventListener(type: "toolchange", listener: EventListener): void {
    if (type === "toolchange") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: "toolchange", listener: EventListener): void {
    if (type === "toolchange") {
      this.listeners.delete(listener);
    }
  }

  addRemoteTool(tool: DiscoveredTool, handler: RemoteHandler): void {
    this.remoteTools.set(remoteKey(tool.origin, tool.name), { tool, handler });
    this.emitToolChange();
  }

  removeRemoteTool(origin: string, name: string): void {
    this.remoteTools.delete(remoteKey(origin, name));
    this.emitToolChange();
  }

  registrationOptionsFor(name: string): ToolRegistrationOptions | undefined {
    return this.localTools.get(name)?.options;
  }

  private emitToolChange(): void {
    const event = new Event("toolchange");
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
