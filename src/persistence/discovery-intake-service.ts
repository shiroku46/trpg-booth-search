import { toProductDiscoveryRequests } from "../discovery-manifest";
import type {
  LoadedDiscoveryManifest,
  PostgresDiscoveryManifestRepository,
} from "./discovery-manifest-repository";

export type BlockedDiscoveryIdentity = Readonly<{
  productId: string;
  canonicalUrl: string;
  classificationState: "unclassified";
  ageState: "unknown";
  detailAccessAuthorized: false;
  publicationEligible: false;
}>;

export type DiscoveryIntakeFound = Readonly<{
  state: "found";
  manifestFingerprint: string;
  source: Readonly<{
    sourceSha: string;
    parserVersion: string;
    listingUrl: string;
    listingRawSha256: string;
  }>;
  identities: readonly BlockedDiscoveryIdentity[];
}>;

export type DiscoveryIntakeMissing = Readonly<{
  state: "manifest_not_found";
  manifestFingerprint: string;
  identities: readonly [];
}>;

export type DiscoveryIntakeReport =
  | DiscoveryIntakeFound
  | DiscoveryIntakeMissing;

type DiscoveryManifestLoader = Pick<
  PostgresDiscoveryManifestRepository,
  "load"
>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function reportFromLoaded(
  loaded: LoadedDiscoveryManifest,
): DiscoveryIntakeFound {
  const requests = toProductDiscoveryRequests(loaded.manifest);
  const identities = requests.map((request) =>
    Object.freeze({
      productId: request.productId,
      canonicalUrl: request.canonicalUrl,
      classificationState: request.classificationState,
      ageState: request.ageState,
      detailAccessAuthorized: false as const,
      publicationEligible: request.publicationEligible,
    }),
  );

  return deepFreeze({
    state: "found" as const,
    manifestFingerprint: loaded.fingerprint,
    source: {
      sourceSha: loaded.sourceSha,
      parserVersion: loaded.parserVersion,
      listingUrl: loaded.listingUrl,
      listingRawSha256: loaded.listingRawSha256,
    },
    identities,
  });
}

export class DiscoveryIntakeService {
  constructor(private readonly manifests: DiscoveryManifestLoader) {}

  async loadExact(manifestFingerprint: string): Promise<DiscoveryIntakeReport> {
    if (!/^[0-9a-f]{64}$/u.test(manifestFingerprint)) {
      throw new Error("Discovery intake fingerprint is invalid.");
    }

    const loaded = await this.manifests.load(manifestFingerprint);
    if (!loaded) {
      return Object.freeze({
        state: "manifest_not_found" as const,
        manifestFingerprint,
        identities: Object.freeze([]) as readonly [],
      });
    }

    return reportFromLoaded(loaded);
  }
}
