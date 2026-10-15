import { isDomainLabel } from './domain';
import { getIssueLabels, listComments, listPullFiles, mapWithConcurrency, searchOpenPulls, type GitHubClient } from './github';
import { parsePullBody } from './parseBody';
import { findTestReports } from './reports';
import { fileInfo, NO_DETAILS, toPullSummary, type PullDetails, type SearchItem } from './transform';
import { SNAPSHOT_VERSION, type PullSummary, type Snapshot } from './types';

export interface SnapshotOptions {
  repository: string;
  now?: Date;
  concurrency?: number;
  log?: (message: string) => void;
  /** The last published snapshot. PRs it holds with the same `updatedAt` are not fetched again. */
  previous?: Snapshot | null;
  /** Below this many REST requests left, stop fetching details and keep what is known. */
  reserve?: number;
}

export interface SnapshotStats {
  pulls: number;
  /** PRs whose details came from the previous snapshot. */
  reused: number;
  /** PRs whose details were fetched in this run. */
  fetched: number;
  /** PRs left with partial details (fetch failed or budget reserve reached). */
  partial: number;
}

/** A previous summary can stand in for fresh details only if nothing changed and it was complete. */
function cachedDetails(previous: PullSummary | undefined, item: SearchItem): PullDetails | null {
  if (!previous || previous.updatedAt !== item.updated_at) return null;
  if (previous.kindSource !== 'files' || previous.reports === null) return null;
  return {
    files: { kind: previous.kind, sqlFiles: previous.sqlFiles, changedFiles: previous.changedFiles ?? 0 },
    reports: previous.reports,
    topics: previous.topics,
  };
}

/**
 * Reads every open PR, then its changed files, its comments (for test
 * reports) and the labels of its linked issues. A PR that did not change
 * since the previous snapshot keeps its details without new requests. A
 * failed request leaves that part unknown instead of failing the snapshot;
 * only a failed search fails it, so the last deployment stays up.
 */
export async function buildSnapshot(
  client: GitHubClient,
  options: SnapshotOptions,
): Promise<{ snapshot: Snapshot; stats: SnapshotStats }> {
  const { repository, now = new Date(), concurrency = 6, log = () => {}, reserve = 100 } = options;
  const previous =
    options.previous?.version === SNAPSHOT_VERSION && options.previous.repository === repository ? options.previous : null;
  const previousByNumber = new Map(previous?.pulls.map((pull) => [pull.number, pull]));

  const items = await searchOpenPulls(client, repository);
  log(`${items.length} open pull requests`);

  const stats: SnapshotStats = { pulls: items.length, reused: 0, fetched: 0, partial: 0 };
  let reserveLogged = false;
  const budgetLeft = () => {
    const remaining = client.remaining();
    const ok = remaining === null || remaining > reserve;
    if (!ok && !reserveLogged) {
      log(`Only ${remaining} API requests left: keeping the remaining PRs as they are.`);
      reserveLogged = true;
    }
    return ok;
  };

  // Several PRs can link the same issue: fetch its labels once.
  const issueLabels = new Map<number, Promise<string[] | null>>();
  const labelsOf = (number: number) => {
    if (!issueLabels.has(number)) {
      issueLabels.set(
        number,
        getIssueLabels(client, repository, number).catch((error: Error) => {
          log(`issue #${number}: labels unavailable (${error.message})`);
          return null;
        }),
      );
    }
    return issueLabels.get(number)!;
  };

  const pulls = await mapWithConcurrency(items, concurrency, async (item) => {
    if (item.draft) return toPullSummary(item, NO_DETAILS, repository);

    const cached = cachedDetails(previousByNumber.get(item.number), item);
    if (cached) {
      stats.reused++;
      return toPullSummary(item, cached, repository);
    }

    const stale = previousByNumber.get(item.number);
    if (!budgetLeft()) {
      stats.partial++;
      // Better an hour-old picture than none: keep what the last snapshot knew.
      return toPullSummary(item, stale ? { files: null, reports: stale.reports, topics: stale.topics } : NO_DETAILS, repository);
    }

    const { issues } = parsePullBody(item.body, repository);
    const [files, comments, labelLists] = await Promise.all([
      listPullFiles(client, repository, item.number).catch((error: Error) => {
        log(`#${item.number}: files unavailable, using labels (${error.message})`);
        return null;
      }),
      listComments(client, repository, item.number).catch((error: Error) => {
        log(`#${item.number}: comments unavailable (${error.message})`);
        return null;
      }),
      Promise.all(issues.map(labelsOf)),
    ]);

    const login = item.user?.login ?? '';
    const details: PullDetails = {
      files: files ? fileInfo(files) : null,
      reports: comments ? findTestReports(comments, login) : null,
      topics: [...new Set(labelLists.flatMap((labels) => labels ?? []).filter(isDomainLabel))],
    };
    if (!details.files || !details.reports) stats.partial++;
    else stats.fetched++;
    return toPullSummary(item, details, repository);
  });

  return { snapshot: { version: SNAPSHOT_VERSION, generatedAt: now.toISOString(), repository, pulls }, stats };
}
