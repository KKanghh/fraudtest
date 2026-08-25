import "server-only";
import raw from "@/data/seed-scenarios.json";
import type { SeedScenario } from "./types";

const seedScenarios = raw.scenarios as SeedScenario[];

export function getAllSeedScenarios(): SeedScenario[] {
  return seedScenarios;
}

export function getSeedScenarioById(id: string): SeedScenario | undefined {
  return seedScenarios.find((scenario) => scenario.id === id);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 같은 유형이 연달아 나오지 않도록 유형별로 고르게 섞은 뒤 앞에서부터 잘라 세트를 구성한다.
// excludeIds로 최근에 푼 문항을 넘기면 최대한 피해서 뽑되, 제외하고 남은 후보가
// count보다 적으면(=거의 다 풀어봄) 전체 풀로 리셋해 항상 count개를 채운다.
export function pickQuizSet(count: number, excludeIds: Iterable<string> = []): string[] {
  const exclude = new Set(excludeIds);
  const fresh = seedScenarios.filter((scenario) => !exclude.has(scenario.id));
  const pool = fresh.length >= count ? fresh : seedScenarios;

  const byType = new Map<string, SeedScenario[]>();
  for (const scenario of pool) {
    const bucket = byType.get(scenario.type) ?? [];
    bucket.push(scenario);
    byType.set(scenario.type, bucket);
  }

  const buckets = shuffle([...byType.values()].map((bucket) => shuffle(bucket)));
  const ordered: SeedScenario[] = [];
  let round = 0;
  while (ordered.length < count) {
    let addedInRound = false;
    for (const bucket of buckets) {
      if (bucket[round]) {
        ordered.push(bucket[round]);
        addedInRound = true;
        if (ordered.length >= count) break;
      }
    }
    if (!addedInRound) break;
    round += 1;
  }

  return ordered.slice(0, count).map((scenario) => scenario.id);
}
