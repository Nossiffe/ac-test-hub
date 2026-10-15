import type { QueueFilters as Filters, SortKey, StatusFilter } from '../lib/queue';
import type { ChangeKind } from '../lib/types';
import { KIND_TEXT, STATUS_TEXT } from '../format';

interface Props {
  filters: Filters;
  sort: SortKey;
  onFiltersChange: (filters: Filters) => void;
  onSortChange: (sort: SortKey) => void;
  shown: number;
  total: number;
}

const STATUS_OPTIONS: Array<[StatusFilter, string]> = [
  ['testable', 'Ready to test'],
  ['all', 'All open'],
  ...(['waiting', 'in-progress', 'open', 'needs-info', 'tested', 'to-merge', 'conflicts', 'wip'] as const).map(
    (status): [StatusFilter, string] => [status, STATUS_TEXT[status]],
  ),
];

const KIND_OPTIONS: Array<['all' | ChangeKind, string]> = [
  ['all', 'Any'],
  ['sql-only', KIND_TEXT['sql-only']],
  ['build', KIND_TEXT.build],
  ['other', KIND_TEXT.other],
];

const SORT_OPTIONS: Array<[SortKey, string]> = [
  ['priority', 'Most needed'],
  ['oldest', 'Oldest'],
  ['updated', 'Recently updated'],
  ['quiet', 'Least discussed'],
];

export function QueueFilters({ filters, sort, onFiltersChange, onSortChange, shown, total }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onFiltersChange({ ...filters, [key]: value });

  return (
    <div className="filters" role="search">
      <label className="field field--search">
        <span className="visually-hidden">Search pull requests</span>
        <input
          type="search"
          placeholder="Search a title, #number, author or label"
          value={filters.query}
          onChange={(event) => set('query', event.target.value)}
        />
      </label>

      <div className="filters__row">
        <label className="field">
          <span className="field__label">Show</span>
          <select value={filters.status} onChange={(event) => set('status', event.target.value as StatusFilter)}>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Sort</span>
          <select value={sort} onChange={(event) => onSortChange(event.target.value as SortKey)}>
            {SORT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="segmented">
        <legend className="field__label">Changes</legend>
        {KIND_OPTIONS.map(([value, label]) => (
          <label key={value} className="segmented__option">
            <input type="radio" name="kind" value={value} checked={filters.kind === value} onChange={() => set('kind', value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="filters__toggles">
        <label className="toggle">
          <input type="checkbox" checked={filters.testersWantedOnly} onChange={(event) => set('testersWantedOnly', event.target.checked)} />
          <span>Asking for testers</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={filters.withInstructionsOnly} onChange={(event) => set('withInstructionsOnly', event.target.checked)} />
          <span>Has test steps</span>
        </label>
      </div>

      <p className="filters__count" aria-live="polite">
        {shown === total ? `${total} pull requests` : `${shown} of ${total} pull requests`}
      </p>
    </div>
  );
}
