import type { ChangeKind, PullStatus } from './lib/types';

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export const STATUS_TEXT: Record<PullStatus, string> = {
  waiting: 'Waiting to be tested',
  'in-progress': 'Testing in progress',
  open: 'Open',
  'needs-info': 'Waiting for the author',
  tested: 'Tested',
  'to-merge': 'To be merged',
  conflicts: 'Merge conflicts',
  wip: 'Work in progress',
};

export const KIND_TEXT: Record<ChangeKind, string> = {
  'sql-only': 'SQL only',
  build: 'Rebuild',
  other: 'Other',
};

export const KIND_HINT: Record<ChangeKind, string> = {
  'sql-only': 'Only SQL changes: import the files and restart, no rebuild.',
  build: 'C++ or CMake changes: the server must be rebuilt.',
  other: 'No C++ change, and not only SQL: tooling, configuration, tests…',
};
