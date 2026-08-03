import type { FixtureRepository, PublicScenario, SeededRandom } from "./domain";
import { project } from "./publication";
export class HashSeededRandom implements SeededRandom {
  order<T extends { id: string }>(values: readonly T[], seed: string): T[] {
    const hash = (s: string) => {
      let h = 2166136261;
      for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      return h >>> 0;
    };
    return [...values].sort(
      (a, b) =>
        hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`) ||
        a.id.localeCompare(b.id),
    );
  }
}
export function search(
  repo: FixtureRepository,
  query = "",
  system = "",
  sort = "title",
  seed = "demo",
): PublicScenario[] {
  const products = new Map(repo.products().map((p) => [p.id, p]));
  const rows = repo
    .scenarios()
    .map((s) => project(products.get(s.productId), s))
    .filter((d): d is Extract<typeof d, { publish: true }> => d.publish)
    .map((d) => d.value)
    .filter(
      (s) =>
        s.title
          .toLocaleLowerCase("ja")
          .includes(query.toLocaleLowerCase("ja")) &&
        (!system || s.systems.includes(system)),
    );
  return sort === "random"
    ? new HashSeededRandom().order(rows, seed)
    : rows.sort((a, b) => a.title.localeCompare(b.title, "ja"));
}
