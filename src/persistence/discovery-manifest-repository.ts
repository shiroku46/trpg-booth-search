import { eq } from "drizzle-orm";

import {
  type DiscoveryManifest,
  validateDiscoveryManifest,
} from "../discovery-manifest";
import type { PersistenceDatabase } from "./database";
import { discoveryManifest } from "./schema";

export type DiscoveryManifestInstallResult = Readonly<{
  state: "inserted" | "existing";
  fingerprint: string;
}>;

export type LoadedDiscoveryManifest = Readonly<{
  fingerprint: string;
  schemaVersion: number;
  sourceSha: string;
  parserVersion: string;
  listingUrl: string;
  listingRawSha256: string;
  installedAt: string;
  manifest: DiscoveryManifest;
}>;

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("Discovery manifest install timestamp is invalid.");
  }
  return parsed.toISOString().replace(".000Z", "Z");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function detachedManifest(value: unknown): DiscoveryManifest {
  return validateDiscoveryManifest(structuredClone(value));
}

function canonicalManifestJson(value: DiscoveryManifest): string {
  return JSON.stringify(value);
}

function verifiedRow(
  row: typeof discoveryManifest.$inferSelect,
): LoadedDiscoveryManifest {
  const manifest = detachedManifest(row.manifest);
  if (
    manifest.fingerprint !== row.fingerprint ||
    manifest.schemaVersion !== row.schemaVersion ||
    manifest.source.sourceSha !== row.sourceSha ||
    manifest.source.parserVersion !== row.parserVersion ||
    manifest.source.listingUrl !== row.listingUrl ||
    manifest.source.listingRawSha256 !== row.listingRawSha256
  ) {
    throw new Error(
      "Discovery manifest column metadata does not match validated manifest metadata.",
    );
  }

  return deepFreeze({
    fingerprint: row.fingerprint,
    schemaVersion: row.schemaVersion,
    sourceSha: row.sourceSha,
    parserVersion: row.parserVersion,
    listingUrl: row.listingUrl,
    listingRawSha256: row.listingRawSha256,
    installedAt: normalizeTimestamp(row.installedAt),
    manifest,
  });
}

export class PostgresDiscoveryManifestRepository {
  constructor(private readonly db: PersistenceDatabase) {}

  async install(
    inputManifest: DiscoveryManifest,
    installedAt: string,
  ): Promise<DiscoveryManifestInstallResult> {
    const manifest = detachedManifest(inputManifest);
    const normalizedInstalledAt = normalizeTimestamp(installedAt);

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(discoveryManifest)
        .where(eq(discoveryManifest.fingerprint, manifest.fingerprint));

      if (existing) {
        const verified = verifiedRow(existing);
        if (
          canonicalManifestJson(verified.manifest) !==
          canonicalManifestJson(manifest)
        ) {
          throw new Error(
            "Discovery manifest fingerprint conflict: immutable content differs.",
          );
        }
        return { state: "existing", fingerprint: manifest.fingerprint };
      }

      await tx.insert(discoveryManifest).values({
        fingerprint: manifest.fingerprint,
        schemaVersion: manifest.schemaVersion,
        sourceSha: manifest.source.sourceSha,
        parserVersion: manifest.source.parserVersion,
        listingUrl: manifest.source.listingUrl,
        listingRawSha256: manifest.source.listingRawSha256,
        manifest,
        installedAt: normalizedInstalledAt,
      });

      return { state: "inserted", fingerprint: manifest.fingerprint };
    });
  }

  async load(fingerprint: string): Promise<LoadedDiscoveryManifest | null> {
    if (!/^[0-9a-f]{64}$/u.test(fingerprint)) {
      throw new Error("Discovery manifest fingerprint lookup is invalid.");
    }
    const [row] = await this.db
      .select()
      .from(discoveryManifest)
      .where(eq(discoveryManifest.fingerprint, fingerprint));
    return row ? verifiedRow(row) : null;
  }
}
