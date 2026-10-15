import type { ChangedFile } from './classify';
import type { SearchItem } from './transform';

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface GitHubClient {
  get<T>(path: string): Promise<T>;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

const API = 'https://api.github.com';

export function createClient(token: string | undefined, fetchImpl: FetchLike = fetch as unknown as FetchLike): GitHubClient {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ac-test-hub',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return {
    async get<T>(path: string): Promise<T> {
      const response = await fetchImpl(`${API}${path}`, { headers });
      if (!response.ok) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        const hint = remaining === '0' ? ' (rate limit reached: set GITHUB_TOKEN)' : '';
        const detail = (await response.text()).slice(0, 200);
        throw new GitHubError(`GET ${path} failed with ${response.status}${hint}: ${detail}`, response.status);
      }
      return (await response.json()) as T;
    },
  };
}

const PER_PAGE = 100;

/** All open pull requests of the repository, oldest first. The search API stops at 1,000 results. */
export async function searchOpenPulls(client: GitHubClient, repository: string): Promise<SearchItem[]> {
  const q = encodeURIComponent(`repo:${repository} is:pr is:open`);
  const items: SearchItem[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await client.get<{ total_count: number; items: SearchItem[] }>(
      `/search/issues?q=${q}&sort=created&order=asc&per_page=${PER_PAGE}&page=${page}`,
    );
    items.push(...result.items);
    if (result.items.length < PER_PAGE || items.length >= result.total_count) break;
  }
  return items;
}

/** Changed files of a pull request (GitHub lists up to 3,000). */
export async function listPullFiles(client: GitHubClient, repository: string, number: number): Promise<ChangedFile[]> {
  const files: ChangedFile[] = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await client.get<ChangedFile[]>(`/repos/${repository}/pulls/${number}/files?per_page=${PER_PAGE}&page=${page}`);
    files.push(...batch.map(({ filename, raw_url }) => ({ filename, raw_url })));
    if (batch.length < PER_PAGE) break;
  }
  return files;
}

/** Runs `task` over `items` with at most `limit` calls in flight, keeping the input order. */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
