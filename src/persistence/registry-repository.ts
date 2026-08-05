import { createHash } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import {
  type RegistryManifest,
  validateRegistry,
} from "../registry";
import type { PersistenceDatabase } from "./database";
import { registrySnapshot } from "./schema";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type RegistrySnapshotInstallResult = {
  state: "inserted" | "existing";
  registryVersion: string;
  manifestSha256: string;
};

export type LoadedRegistrySnapshot = {
  registryVersion: string;
  schemaVersion: number;
  normalizerVersion: string;
  reviewedAt: string;
  manifestSha256: string;
  installedAt: string;
  manifest: RegistryManifest;
};

function canonicalizeJson(value: unknown, path = "$root"): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  )
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error(`Registry JSON contains a non-finite number at ${path}.`);
    return value;
  }
  if (Array.isArray(value))
    return value.map((item, index) =>
      canonicalizeJson(item, `${path}[${index}]`),
    );
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [
          key,
          canonicalizeJson(source[key], `${path}.${key}`),
        ]),
    );
  }
  throw new Error(`Registry JSON contains an unsupported value at ${path}.`);
}

export function canonicalRegistryJson(registry: RegistryManifest): string {
  return JSON.stringify(canonicalizeJson(registry));
}

export function registryManifestSha256(registry: RegistryManifest): string {
  return createHash("sha256")
    .update(canonicalRegistryJson(registry), "utf8")
    .digest("hex");
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()))
    throw new Error("Registry snapshot timestamp is invalid.");
  return parsed.toISOString().replace(".000Z", "Z");
}

function assertRegistryValid(registry: RegistryManifest): void {
  const validation = validateRegistry(registry);
  if (!validation.valid)
    throw new Error(
      `Registry manifest validation failed:\n${validation.errors.join("\n")}`,
    );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      deepFreeze(nested);
  }
  return value;
}

function detachedRegistry(registry: RegistryManifest): RegistryManifest {
  return deepFreeze(structuredClone(registry));
}

function verifiedSnapshot(
  row: typeof registrySnapshot.$inferSelect,
): LoadedRegistrySnapshot {
  const manifest = structuredClone(row.manifest) as RegistryManifest;
  assertRegistryValid(manifest);

  const actualSha256 = registryManifestSha256(manifest);
  if (actualSha256 !== row.manifestSha256)
    throw new Error("Registry snapshot fingerprint verification failed.");
  if (
    manifest.registryVersion !== row.registryVersion ||
    manifest.schemaVersion !== row.schemaVersion ||
    manifest.normalizerVersion !== row.normalizerVersion ||
    manifest.reviewedAt !== row.reviewedAt
  )
    throw new Error("Registry snapshot column metadata does not match manifest metadata.");

  return deepFreeze({
    registryVersion: row.registryVersion,
    schemaVersion: row.schemaVersion,
    normalizerVersion: row.normalizerVersion,
    reviewedAt: row.reviewedAt,
    manifestSha256: row.manifestSha256,
    installedAt: normalizeTimestamp(row.installedAt),
    manifest: detachedRegistry(manifest),
  });
}

export class PostgresRegistrySnapshotRepository {
  constructor(private readonly db: PersistenceDatabase) {}

  async install(
    inputRegistry: RegistryManifest,
    installedAt: string,
  ): Promise<RegistrySnapshotInstallResult> {
    const manifest = structuredClone(inputRegistry) as RegistryManifest;
    assertRegistryValid(manifest);
    const normalizedInstalledAt = normalizeTimestamp(installedAt);
    const manifestSha256 = registryManifestSha256(manifest);

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(registrySnapshot)
        .where(eq(registrySnapshot.registryVersion, manifest.registryVersion));

      if (existing) {
        const verified = verifiedSnapshot(existing);
        if (
          verified.manifestSha256 !== manifestSha256 ||
          canonicalRegistryJson(verified.manifest) !== canonicalRegistryJson(manifest)
        )
          throw new Error(
            "Registry version conflict: an immutable version already contains different content.",
          );
        return {
          state: "existing",
          registryVersion: verified.registryVersion,
          manifestSha256,
        };
      }

      await tx.insert(registrySnapshot).values({
        registryVersion: manifest.registryVersion,
        schemaVersion: manifest.schemaVersion,
        normalizerVersion: manifest.normalizerVersion,
        reviewedAt: manifest.reviewedAt,
        manifestSha256,
        manifest,
        installedAt: normalizedInstalledAt,
      });

      return {
        state: "inserted",
        registryVersion: manifest.registryVersion,
        manifestSha256,
      };
    });
  }

  async load(registryVersion: string): Promise<LoadedRegistrySnapshot | null> {
    const [row] = await this.db
      .select()
      .from(registrySnapshot)
      .where(eq(registrySnapshot.registryVersion, registryVersion));
    return row ? verifiedSnapshot(row) : null;
  }

  async listVersions(): Promise<string[]> {
    const rows = await this.db
      .select({ registryVersion: registrySnapshot.registryVersion })
      .from(registrySnapshot)
      .orderBy(asc(registrySnapshot.registryVersion));
    return rows.map(({ registryVersion }) => registryVersion);
  }
}
