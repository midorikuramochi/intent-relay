import type { DiscoveredTool, ModelContextPort } from "./modelContext";

export interface ProviderToolInventory {
  gather: DiscoveredTool[];
  orbit: DiscoveredTool[];
}

export async function discoverProviderTools(
  port: ModelContextPort,
  origins: { gather: string; orbit: string },
): Promise<ProviderToolInventory> {
  const tools = await port.getTools({ fromOrigins: [origins.gather, origins.orbit] });
  return {
    gather: tools.filter((tool) => tool.origin === origins.gather),
    orbit: tools.filter((tool) => tool.origin === origins.orbit),
  };
}
