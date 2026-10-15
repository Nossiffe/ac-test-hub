import { useEffect, useMemo, useRef, useState } from 'react';
import { PullDetail, type ServerPrefs } from './components/PullDetail';
import { PullList } from './components/PullList';
import { QueueFilters } from './components/QueueFilters';
import { timeAgo } from './format';
import { useHashSelection, useSnapshot, useStoredState } from './hooks';
import { WIKI } from './lib/config';
import { DEFAULT_FILTERS, filterPulls, sortPulls, wantsTesters, type QueueFilters as Filters, type SortKey } from './lib/queue';
import type { Snapshot } from './lib/types';

const DEFAULT_PREFS: ServerPrefs = { setup: 'docker', fork: false, os: '' };

function Summary({ snapshot }: { snapshot: Snapshot }) {
  const labelled = snapshot.pulls.filter((p) => p.status === 'waiting').length;
  const asking = snapshot.pulls.filter((p) => wantsTesters(p) && p.status !== 'waiting').length;
  return (
    <p className="masthead__lede">
      {asking + labelled} open pull requests are asking for testers
      {labelled > 0 && `, ${labelled} of them labelled “Waiting to be Tested”`}. Pick one, run it on your server, post what you
      saw.
    </p>
  );
}

function Hub({ snapshot, sample }: { snapshot: Snapshot; sample: boolean }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useStoredState<{ key: SortKey }>('ac-test-hub:sort', { key: 'priority' });
  const [prefs, setPrefs] = useStoredState<ServerPrefs>('ac-test-hub:prefs', DEFAULT_PREFS);
  const [selected, select] = useHashSelection();
  const detailRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => sortPulls(filterPulls(snapshot.pulls, filters), sort.key), [snapshot, filters, sort.key]);
  const current = snapshot.pulls.find((p) => p.number === selected) ?? null;

  // On wide screens, open the first PR so the page never starts empty.
  useEffect(() => {
    if (selected === null && visible.length > 0 && window.matchMedia('(min-width: 960px)').matches) {
      history.replaceState(null, '', `#${visible[0].number}`);
      select(visible[0].number);
    }
  }, [selected, visible, select]);

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [selected]);

  return (
    <div className="hub" data-has-selection={current ? 'true' : 'false'}>
      <header className="masthead">
        <div className="masthead__title">
          <h1>Test Hub</h1>
          <p className="masthead__for">for AzerothCore pull requests</p>
        </div>
        <Summary snapshot={snapshot} />
        <p className="masthead__meta">
          {sample ? (
            <strong className="sample-flag">Made-up sample data</strong>
          ) : (
            <>
              Updated <time dateTime={snapshot.generatedAt}>{timeAgo(snapshot.generatedAt)}</time>
            </>
          )}
          <span aria-hidden="true"> / </span>
          <a href={WIKI.howToTestPr} target="_blank" rel="noreferrer noopener">
            How to test a PR
          </a>
        </p>
      </header>

      <aside className="queue" aria-label="Pull requests">
        <QueueFilters
          filters={filters}
          sort={sort.key}
          onFiltersChange={setFilters}
          onSortChange={(key) => setSort({ key })}
          shown={visible.length}
          total={snapshot.pulls.length}
        />
        <PullList pulls={visible} selected={selected} onSelect={select} onReset={() => setFilters(DEFAULT_FILTERS)} />
      </aside>

      <main className="detail-pane" ref={detailRef}>
        {current ? (
          <PullDetail pull={current} repository={snapshot.repository} prefs={prefs} onPrefsChange={setPrefs} onBack={() => select(null)} />
        ) : selected !== null ? (
          <div className="empty">
            <p>#{selected} isn't an open pull request any more, or isn't in this snapshot.</p>
            <a className="button button--quiet" href={`https://github.com/${snapshot.repository}/pull/${selected}`} target="_blank" rel="noreferrer noopener">
              Look it up on GitHub
            </a>
          </div>
        ) : (
          <div className="empty">
            <p>Pick a pull request to see how to test it.</p>
          </div>
        )}
      </main>

      <footer className="colophon">
        A community tool, not run by the AzerothCore team. Data from the GitHub API, refreshed every hour.
      </footer>
    </div>
  );
}

export function App() {
  const result = useSnapshot();
  if (result.state === 'loading') return <p className="status-screen">Loading pull requests…</p>;
  if (result.state === 'error') return <p className="status-screen">Couldn't load the pull requests: {result.message}</p>;
  return <Hub snapshot={result.snapshot} sample={result.sample} />;
}
