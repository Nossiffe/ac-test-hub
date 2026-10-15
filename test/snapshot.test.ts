import { describe, expect, it } from 'vitest';
import { createClient, mapWithConcurrency, type FetchLike } from '../src/lib/github';
import { buildSnapshot } from '../src/lib/snapshot';
import { filledTemplate } from './fixtures/bodies';

const REPO = 'azerothcore/azerothcore-wotlk';

function searchItem(number: number, extra: Record<string, unknown> = {}) {
  return {
    number,
    title: `PR ${number}`,
    html_url: `https://github.com/${REPO}/pull/${number}`,
    user: { login: 'dev', avatar_url: 'https://avatars.example/dev' },
    labels: [{ name: 'DB' }, { name: 'file-cpp' }],
    draft: false,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
    comments: 2,
    body: filledTemplate,
    ...extra,
  };
}

/** A fake GitHub API answering from a route table. */
function fakeFetch(routes: Record<string, unknown>, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    const path = url.replace('https://api.github.com', '');
    const key = Object.keys(routes).find((route) => path.startsWith(route));
    const body = key ? routes[key] : undefined;
    const ok = body !== undefined;
    return {
      ok,
      status: ok ? 200 : 404,
      headers: { get: () => null },
      json: async () => body,
      text: async () => (ok ? JSON.stringify(body) : 'Not Found'),
    };
  };
}

describe('buildSnapshot', () => {
  it('classifies each PR from its files and parses its description', async () => {
    const calls: string[] = [];
    const client = createClient('token', fakeFetch({
      '/search/issues': { total_count: 3, items: [searchItem(1), searchItem(2), searchItem(3, { draft: true })] },
      [`/repos/${REPO}/pulls/1/files`]: [{ filename: 'data/sql/updates/pending_db_world/rev_1.sql', raw_url: 'raw1' }],
      // PR 2 has no files route: it must fall back on its labels.
    }, calls));

    const snapshot = await buildSnapshot(client, { repository: REPO, now: new Date('2026-10-15T12:00:00Z') });

    expect(snapshot.generatedAt).toBe('2026-10-15T12:00:00.000Z');
    expect(snapshot.pulls.map((p) => [p.number, p.kind, p.kindSource, p.status])).toEqual([
      [1, 'sql-only', 'files', 'open'],
      [2, 'build', 'labels', 'open'],
      [3, 'build', 'labels', 'wip'],
    ]);
    expect(snapshot.pulls[0].sqlFiles[0]).toMatchObject({ database: 'world', rawUrl: 'raw1' });
    expect(snapshot.pulls[0].testing.instructions).toContain('.go creature 12345');
    expect(calls.some((url) => url.includes('/pulls/3/files'))).toBe(false); // drafts are skipped
  });

  it('pages through search results', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => searchItem(i + 1));
    const calls: string[] = [];
    const client = createClient(undefined, async (url) => {
      calls.push(url);
      const page = Number(new URL(url).searchParams.get('page'));
      const body = url.includes('/search/')
        ? { total_count: 101, items: page === 1 ? page1 : [searchItem(101)] }
        : [];
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => '' };
    });

    const snapshot = await buildSnapshot(client, { repository: REPO });
    expect(snapshot.pulls).toHaveLength(101);
    expect(calls.filter((url) => url.includes('/search/'))).toHaveLength(2);
  });

  it('fails loudly when the search itself fails, so the last deployment stays up', async () => {
    const client = createClient(undefined, fakeFetch({}));
    await expect(buildSnapshot(client, { repository: REPO })).rejects.toThrow(/failed with 404/);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps the order and never exceeds the limit', async () => {
    let running = 0;
    let peak = 0;
    const result = await mapWithConcurrency([5, 1, 3, 2, 4], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, n));
      running--;
      return n * 10;
    });
    expect(result).toEqual([50, 10, 30, 20, 40]);
    expect(peak).toBe(2);
  });
});
