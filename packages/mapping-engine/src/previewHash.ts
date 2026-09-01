import type { CompatibilityPreview } from "@intent-relay/protocol";
import { stableStringify } from "./stableJson";

export type PreviewWithoutHash = Omit<CompatibilityPreview, "previewHash">;

/**
 * Hashes the preview over contract revision, capability version, and mappings.
 * `createdAt` is deliberately excluded so identical inputs always produce the
 * same hash regardless of when the preview was created.
 */
export async function computePreviewHash(preview: PreviewWithoutHash): Promise<string> {
  const hashInput = {
    contractId: preview.contractId,
    contractRevision: preview.contractRevision,
    targetProvider: preview.targetProvider,
    targetCapabilityVersion: preview.targetCapabilityVersion,
    mappings: preview.mappings,
  };
  const bytes = new TextEncoder().encode(stableStringify(hashInput));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
