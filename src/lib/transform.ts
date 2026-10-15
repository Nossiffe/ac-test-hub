import { classifyFiles, classifyLabels, statusFromLabels, type ChangedFile } from './classify';
import { parseArea } from './domain';
import { parsePullBody } from './parseBody';
import type { ChangeKind, PullSummary, Snapshot, SqlFile, TestReport } from './types';

/** The fields we use from a GitHub search result item (`GET /search/issues`). */
export interface SearchItem {
  number: number;
  title: string;
  html_url: string;
  user: { login: string; avatar_url: string } | null;
  labels: Array<{ name: string } | string>;
  draft?: boolean;
  created_at: string;
  updated_at: string;
  comments: number;
  body: string | null;
}

/** What the snapshot learns from the changed files. */
export interface FileInfo {
  kind: ChangeKind;
  sqlFiles: SqlFile[];
  changedFiles: number;
}

/** Everything the snapshot fetched about a PR beyond the search result. Each part can be missing. */
export interface PullDetails {
  /** Null when the files could not be read: the kind is then guessed from the labels. */
  files: FileInfo | null;
  /** Null when the comments could not be read. */
  reports: TestReport[] | null;
  topics: string[];
}

export const NO_DETAILS: PullDetails = { files: null, reports: null, topics: [] };

export function fileInfo(files: readonly ChangedFile[]): FileInfo {
  const { kind, sqlFiles } = classifyFiles(files);
  return { kind, sqlFiles, changedFiles: files.length };
}

const labelName = (label: { name: string } | string) => (typeof label === 'string' ? label : label.name);

/** Builds the summary the front displays. */
export function toPullSummary(item: SearchItem, details: PullDetails, repository: string): PullSummary {
  const labels = item.labels.map(labelName);
  const parsed = parsePullBody(item.body, repository);
  const { files } = details;

  return {
    number: item.number,
    title: item.title,
    url: item.html_url,
    author: { login: item.user?.login ?? 'ghost', avatarUrl: item.user?.avatar_url ?? '' },
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    labels,
    status: statusFromLabels(labels, item.draft ?? false),
    kind: files ? files.kind : classifyLabels(labels),
    kindSource: files ? 'files' : 'labels',
    changedFiles: files ? files.changedFiles : null,
    sqlFiles: files ? files.sqlFiles : [],
    comments: item.comments,
    issues: parsed.issues,
    testing: parsed.testing,
    area: parseArea(item.title),
    topics: details.topics,
    reports: details.reports,
  };
}

/**
 * Fills the fields an older data.json lacks (a version 1 file has no area,
 * topics or reports), so the page never breaks on a snapshot from before an upgrade.
 */
export function normalizeSnapshot(raw: Snapshot): Snapshot {
  return {
    ...raw,
    version: raw.version ?? 1,
    pulls: raw.pulls.map((pull) => ({
      ...pull,
      area: pull.area === undefined ? parseArea(pull.title) : pull.area,
      topics: pull.topics ?? [],
      reports: pull.reports === undefined ? null : pull.reports,
    })),
  };
}
