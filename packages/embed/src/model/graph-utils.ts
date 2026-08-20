import type { Job } from "./types";

/**
 * Reverse-adjacency: job id -> ids of jobs that declare it in their own
 * `dependsOn`. Shared by connector.ts (walking a scripted failure's blast
 * radius) and model/index.ts (walking a job's dependency graph) — both
 * need "who depends on this job" by id, not just the by-name version
 * `classifyAllJobs` builds for headline copy.
 */
export function buildDependentIdsMap(jobs: Job[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const job of jobs) {
    for (const depId of job.dependsOn) {
      const arr = map.get(depId) ?? [];
      arr.push(job.id);
      map.set(depId, arr);
    }
  }
  return map;
}
