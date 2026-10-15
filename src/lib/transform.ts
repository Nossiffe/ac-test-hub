import { classifyFiles, classifyLabels, statusFromLabels, type ChangedFile } from './classify';
import { parsePullBody } from './parseBody';
import type { PullSummary } from './types';

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

const labelName = (label: { name: string } | string) => (typeof label === 'string' ? label : label.name);

/** Builds the summary the front displays. `files` is null when they could not be fetched. */
export function toPullSummary(item: SearchItem, files: readonly ChangedFile[] | null, repository: string): PullSummary {
  const labels = item.labels.map(labelName);
  const parsed = parsePullBody(item.body, repository);
  const fromFiles = files ? classifyFiles(files) : null;

  return {
    number: item.number,
    title: item.title,
    url: item.html_url,
    author: { login: item.user?.login ?? 'ghost', avatarUrl: item.user?.avatar_url ?? '' },
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    labels,
    status: statusFromLabels(labels, item.draft ?? false),
    kind: fromFiles ? fromFiles.kind : classifyLabels(labels),
    kindSource: fromFiles ? 'files' : 'labels',
    changedFiles: files ? files.length : null,
    sqlFiles: fromFiles ? fromFiles.sqlFiles : [],
    comments: item.comments,
    issues: parsed.issues,
    testing: parsed.testing,
  };
}
