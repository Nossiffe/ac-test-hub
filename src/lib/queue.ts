import { TESTABLE_STATUSES } from './config';
import type { ChangeKind, PullStatus, PullSummary } from './types';

export type StatusFilter = 'testable' | 'all' | PullStatus;
export type SortKey = 'priority' | 'oldest' | 'updated' | 'quiet';

export interface QueueFilters {
  status: StatusFilter;
  kind: 'all' | ChangeKind;
  withInstructionsOnly: boolean;
  testersWantedOnly: boolean;
  query: string;
}

export const DEFAULT_FILTERS: QueueFilters = {
  status: 'testable',
  kind: 'all',
  withInstructionsOnly: false,
  testersWantedOnly: false,
  query: '',
};

/** Labelled "Waiting to be Tested", or the author ticked "requires further testing". */
export function wantsTesters(pull: PullSummary): boolean {
  return pull.status === 'waiting' || ((pull.status === 'open' || pull.status === 'in-progress') && pull.testing.needsMoreTesting);
}

function matchesQuery(pull: PullSummary, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  if (!q) return true;
  return (
    String(pull.number).includes(q) ||
    pull.title.toLowerCase().includes(q) ||
    pull.author.login.toLowerCase().includes(q) ||
    pull.labels.some((label) => label.toLowerCase().includes(q))
  );
}

export function filterPulls(pulls: readonly PullSummary[], filters: QueueFilters): PullSummary[] {
  return pulls.filter((pull) => {
    if (filters.status === 'testable' && !TESTABLE_STATUSES.includes(pull.status)) return false;
    if (filters.status !== 'testable' && filters.status !== 'all' && pull.status !== filters.status) return false;
    if (filters.kind !== 'all' && pull.kind !== filters.kind) return false;
    if (filters.withInstructionsOnly && !pull.testing.instructions && !pull.testing.reproStepsInIssue) return false;
    if (filters.testersWantedOnly && !wantsTesters(pull)) return false;
    return matchesQuery(pull, filters.query);
  });
}

const STATUS_RANK: Record<PullStatus, number> = {
  waiting: 0,
  open: 1,
  'in-progress': 2,
  'needs-info': 3,
  tested: 4,
  'to-merge': 5,
  conflicts: 6,
  wip: 7,
};

/** Lower is more urgent: labelled first, then PRs asking for testers, then the rest. */
export function priorityRank(pull: PullSummary): number {
  const base = STATUS_RANK[pull.status] * 10;
  const testers = wantsTesters(pull) ? 0 : 5;
  const steps = pull.testing.instructions || pull.testing.reproStepsInIssue ? 0 : 1;
  return base + testers + steps;
}

const time = (iso: string) => new Date(iso).getTime();

export function sortPulls(pulls: readonly PullSummary[], key: SortKey): PullSummary[] {
  const sorted = [...pulls];
  switch (key) {
    case 'priority':
      return sorted.sort((a, b) => priorityRank(a) - priorityRank(b) || time(a.createdAt) - time(b.createdAt));
    case 'oldest':
      return sorted.sort((a, b) => time(a.createdAt) - time(b.createdAt));
    case 'updated':
      return sorted.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
    case 'quiet':
      return sorted.sort((a, b) => a.comments - b.comments || time(a.createdAt) - time(b.createdAt));
  }
}
