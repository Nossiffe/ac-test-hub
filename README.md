# Test Hub for AzerothCore

A page that lists the open [AzerothCore](https://github.com/azerothcore/azerothcore-wotlk) pull requests a community member can test, and for each one gives:

- **what to test**: the steps from the PR description, or a pointer to the linked issue when the author says its reproduction steps apply;
- **how to run it**: the commands from the wiki's [How to test a PR](https://www.azerothcore.org/wiki/how-to-test-a-pr) guide with the PR number filled in, for Docker or a compiled setup. PRs that only change SQL get the simpler [DB-only procedure](https://www.azerothcore.org/wiki/how-to-test-db-only-changes) and direct links to the `.sql` files;
- **a test report**: a form that writes the Markdown comment to post on the PR (result, setup, OS, server revision, what was tested, before/after, regression checks).

It is a community tool, not run by the AzerothCore team.

## Why

[Testing is how a PR reaches `master`](https://www.azerothcore.org/wiki/how-to-test-a-pr), and anyone who can run a server can help. The [Waiting to be Tested](https://github.com/azerothcore/azerothcore-wotlk/pulls?q=is%3Apr+is%3Aopen+label%3A%22Waiting+to+be+Tested%22) label alone shows very few of the [open PRs](https://github.com/azerothcore/azerothcore-wotlk/pulls?q=is%3Apr+is%3Aopen) (2 of 133 on 15 October 2026). The [PR template](https://github.com/azerothcore/azerothcore-wotlk/blob/master/pull_request_template.md) also has a "This pull request requires further testing" box. The hub lists both kinds of PR and puts them first.

## How it works

```
GitHub Actions, every hour
  npm run snapshot ── GitHub API ──> public/data.json ──> npm run build ──> GitHub Pages
                      (search + changed files of each open PR)
```

There is no server and no token in the browser. A scheduled workflow reads public data with its own token, writes one JSON file and publishes a static site. If the snapshot fails, nothing is deployed and the previous site stays up.

For each open PR the snapshot works out:

| Field | Source |
| --- | --- |
| Status (waiting, in progress, tested, conflicts…) | Labels, in the priority order of `src/lib/config.ts` |
| SQL only / rebuild / other | The changed files: only `data/sql/**.sql` (and docs) means no rebuild. When the files can't be read it falls back on the labels of the repository's [PR labeler](https://github.com/azerothcore/azerothcore-wotlk/blob/master/.github/workflows/pr_labeler.yml), which is less reliable: it runs with `sync-labels: false`, so it never removes a label |
| Test steps | The "How to Test the Changes" section, without the template's checkboxes and empty `1. 2. 3.` placeholders. A few free-form headings are recognised too ("Test plan", "In-game checks"…) |
| "Asking for testers" | The "Waiting to be Tested" label, or the "requires further testing" box ticked |
| Linked issues | The "Issues Addressed" section |

## Run it locally

Requires Node.js 22.12 or later.

```sh
npm install
npm run sample   # writes public/data.sample.json, made-up PRs
npm run dev      # the dev server falls back on the sample when data.json is missing
```

To work with real data, create a [fine-grained token](https://github.com/settings/personal-access-tokens) with no permissions (public data only) and run:

```sh
GITHUB_TOKEN=<token> npm run snapshot   # writes public/data.json
```

Without a token GitHub allows [60 requests an hour](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), fewer than one snapshot needs.

Other commands: `npm test`, `npm run typecheck`, `npm run build`.

## Deploy your own

1. Push this repository to GitHub.
2. In **Settings > Pages**, set the source to **GitHub Actions**.
3. Run the **Snapshot and deploy** workflow once from the Actions tab. After that it runs every hour and on every push to `main`.

The site uses relative paths, so it works under any `https://<user>.github.io/<repo>/` address. In a public repository, GitHub [disables scheduled workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows) after 60 days without activity; re-enable it from the Actions tab if that happens.

To point the hub at another repository, set `AC_REPOSITORY` (for example `azerothcore/mod-eluna`) in the workflow's snapshot step.

## Project layout

```
scripts/snapshot.ts   writes public/data.json
scripts/sample.ts     writes public/data.sample.json
src/lib/              snapshot, parsing, classification, queue and report logic (no React)
src/components/       the page
test/                 unit tests (Vitest), fixtures modelled on real PR descriptions
```

## Limits

- The data is at most an hour old.
- "Tested by someone" is read from the labels and the author's checkboxes, not from the comments.
- The report is copied, not posted: the tester pastes it on the PR with their own GitHub account.

## Credits

The testing steps come from the AzerothCore wiki.

## License

[MIT](LICENSE)
