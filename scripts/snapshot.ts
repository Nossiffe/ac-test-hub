/**
 * Writes public/data.json: the open pull requests of AzerothCore, ready for the front.
 *
 *   GITHUB_TOKEN=... npm run snapshot
 *
 * Without a token GitHub allows 60 requests an hour, which is not enough for
 * one snapshot (one request per PR). In GitHub Actions the workflow token is used.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { REPOSITORY } from '../src/lib/config';
import { createClient } from '../src/lib/github';
import { buildSnapshot } from '../src/lib/snapshot';

const repository = process.env.AC_REPOSITORY ?? REPOSITORY;
const output = process.env.SNAPSHOT_OUT ?? 'public/data.json';

const snapshot = await buildSnapshot(createClient(process.env.GITHUB_TOKEN), {
  repository,
  log: (message) => console.log(message),
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(snapshot));

const byKind = Object.groupBy(snapshot.pulls, (p) => p.kind);
const fallback = snapshot.pulls.filter((p) => p.kindSource === 'labels').length;
console.log(
  `Wrote ${output}: ${snapshot.pulls.length} PRs ` +
    `(${byKind['sql-only']?.length ?? 0} SQL only, ${byKind.build?.length ?? 0} need a build, ` +
    `${byKind.other?.length ?? 0} other; ${fallback} classified from labels)`,
);
