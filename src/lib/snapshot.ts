import { listPullFiles, mapWithConcurrency, searchOpenPulls, type GitHubClient } from './github';
import { toPullSummary } from './transform';
import type { Snapshot } from './types';

export interface SnapshotOptions {
  repository: string;
  now?: Date;
  concurrency?: number;
  log?: (message: string) => void;
}

/**
 * Reads every open PR and its changed files, then builds the data the front
 * displays. A PR whose files can't be read falls back on its labels instead
 * of failing the whole snapshot.
 */
export async function buildSnapshot(client: GitHubClient, options: SnapshotOptions): Promise<Snapshot> {
  const { repository, now = new Date(), concurrency = 6, log = () => {} } = options;
  const items = await searchOpenPulls(client, repository);
  log(`${items.length} open pull requests`);

  const pulls = await mapWithConcurrency(items, concurrency, async (item) => {
    if (item.draft) return toPullSummary(item, null, repository);
    try {
      return toPullSummary(item, await listPullFiles(client, repository, item.number), repository);
    } catch (error) {
      log(`#${item.number}: files unavailable, using labels (${(error as Error).message})`);
      return toPullSummary(item, null, repository);
    }
  });

  return { generatedAt: now.toISOString(), repository, pulls };
}
