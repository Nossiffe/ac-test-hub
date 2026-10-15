import { Fragment } from 'react';
import { WIKI } from '../lib/config';
import { testSteps } from '../lib/commands';
import { wantsTesters } from '../lib/queue';
import type { ServerSetup } from '../lib/report';
import type { PullSummary } from '../lib/types';
import { areaText, KIND_HINT, KIND_TEXT, REPORT_KIND_TEXT, REPORT_RESULT_TEXT, STATUS_TEXT, timeAgo } from '../format';
import { CopyButton } from './CopyButton';
import { Markdown } from './Markdown';
import { ReportForm } from './ReportForm';

export interface ServerPrefs {
  setup: ServerSetup;
  fork: boolean;
  os: string;
}

interface Props {
  pull: PullSummary;
  repository: string;
  prefs: ServerPrefs;
  onPrefsChange: (prefs: ServerPrefs) => void;
  onBack: () => void;
}

/** Renders `code` spans in short notes. */
function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, index) =>
        part.startsWith('`') && part.endsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : <Fragment key={index}>{part}</Fragment>,
      )}
    </>
  );
}

const issueLink = (repository: string, n: number) => `https://github.com/${repository}/issues/${n}`;

/** Reports already posted on the PR, newest first, each linked to its comment. */
function Reports({ pull }: { pull: PullSummary }) {
  if (pull.reports === null) {
    return <p className="reports__none">The comments couldn't be read in the last update, so earlier reports aren't shown.</p>;
  }
  if (pull.reports.length === 0) {
    return <p className="reports__none">Nobody else has posted a test report yet.</p>;
  }
  const reports = [...pull.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <ul className="reports">
      {reports.map((report) => (
        <li key={report.url} className="reports__item" data-result={report.result}>
          <span className="reports__result">{REPORT_RESULT_TEXT[report.result]}</span>
          <span>
            {REPORT_KIND_TEXT[report.kind]} by <strong>{report.author}</strong> {timeAgo(report.createdAt)}.{' '}
            <a href={report.url} target="_blank" rel="noreferrer noopener">
              Read the report
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PullDetail({ pull, repository, prefs, onPrefsChange, onBack }: Props) {
  const steps = testSteps(pull, prefs);
  const { testing } = pull;
  const area = areaText(pull.area);
  const guide = pull.kind === 'sql-only' ? WIKI.howToTestDbOnly : WIKI.howToTestPr;

  return (
    <article className="detail" aria-labelledby="detail-title">
      <button type="button" className="detail__back button button--quiet" onClick={onBack}>
        All pull requests
      </button>

      <header className="detail__header">
        <p className="detail__number">#{pull.number}</p>
        <h2 id="detail-title" className="detail__title">
          {pull.title}
        </h2>
        <p className="detail__byline">
          Opened by{' '}
          <a href={`https://github.com/${pull.author.login}`} target="_blank" rel="noreferrer noopener">
            {pull.author.login}
          </a>{' '}
          {timeAgo(pull.createdAt)}, updated {timeAgo(pull.updatedAt)}.{' '}
          {pull.comments === 0 ? 'No comments yet.' : `${pull.comments} comment${pull.comments > 1 ? 's' : ''}.`}
        </p>
        <div className="detail__tags">
          <span className="tag" data-kind={pull.kind}>
            {KIND_TEXT[pull.kind]}
          </span>
          {pull.status !== 'open' && (
            <span className="tag" data-status={pull.status}>
              {STATUS_TEXT[pull.status]}
            </span>
          )}
          {wantsTesters(pull) && pull.status !== 'waiting' && <span className="tag" data-wanted>Asking for testers</span>}
          {testing.testedByAuthor && <span className="tag">Tested by the author</span>}
          {testing.testedByOthers && <span className="tag">Tested by others</span>}
        </div>
        <p className="detail__kind">
          {KIND_HINT[pull.kind]}
          {pull.kindSource === 'labels' && ' (Guessed from the labels: the changed files could not be read.)'}
        </p>
        {(area || pull.topics.length > 0) && (
          <dl className="detail__facts">
            {area && (
              <>
                <dt>Code area</dt>
                <dd>{area}</dd>
              </>
            )}
            {pull.topics.length > 0 && (
              <>
                <dt>Linked issue</dt>
                <dd>{pull.topics.map((topic) => topic.replace(/^(Class|Instance) - /, '')).join(', ')}</dd>
              </>
            )}
          </dl>
        )}
        <a className="button button--primary" href={pull.url} target="_blank" rel="noreferrer noopener">
          Open on GitHub
        </a>
      </header>

      {pull.status === 'conflicts' && (
        <p className="notice">This PR has merge conflicts: it can't be tested until the author fixes them.</p>
      )}
      {pull.status === 'wip' && <p className="notice">This PR is still a work in progress: the author may change it before testing.</p>}

      <ol className="steps">
        <li className="step">
          <h3 className="step__title">Read what to test</h3>
          {testing.instructions && (
            <>
              <Markdown repository={repository}>{testing.instructions}</Markdown>
              <p className="step__source">From the “{testing.instructionsHeading}” section of the PR.</p>
            </>
          )}
          {testing.reproStepsInIssue && (
            <p>
              The author says the reproduction steps of the linked issue apply
              {pull.issues.length > 0 ? ': ' : '.'}
              {pull.issues.map((n, index) => (
                <Fragment key={n}>
                  {index > 0 && ', '}
                  <a href={issueLink(repository, n)} target="_blank" rel="noreferrer noopener">
                    #{n}
                  </a>
                </Fragment>
              ))}
              {pull.issues.length > 0 && '.'}
            </p>
          )}
          {!testing.instructions && !testing.reproStepsInIssue && (
            <p>
              The author gave no test steps. You can ask for them in a comment, or read the{' '}
              <a href={`${pull.url}/files`} target="_blank" rel="noreferrer noopener">
                changed files
              </a>{' '}
              and decide what to test: just say what you tested in your report.
            </p>
          )}
          {testing.authorTests && (
            <details className="disclosure" open={!testing.instructions}>
              <summary>What the author tested</summary>
              <Markdown repository={repository}>{testing.authorTests}</Markdown>
            </details>
          )}
          {pull.kind === 'build' && (
            <p className="step__reminder">
              Code changes can break more than what they fix: also check that related cases still work.
            </p>
          )}
        </li>

        <li className="step">
          <h3 className="step__title">Run it on your server</h3>
          <div className="server-prefs">
            <fieldset className="segmented">
              <legend className="field__label">Your setup</legend>
              {(
                [
                  ['docker', 'Docker'],
                  ['traditional', 'Compiled from sources'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="segmented__option">
                  <input type="radio" name="setup" value={value} checked={prefs.setup === value} onChange={() => onPrefsChange({ ...prefs, setup: value })} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            {pull.kind !== 'sql-only' && (
              <label className="toggle">
                <input type="checkbox" checked={prefs.fork} onChange={(event) => onPrefsChange({ ...prefs, fork: event.target.checked })} />
                <span>My clone is a fork (use the upstream remote)</span>
              </label>
            )}
          </div>

          {pull.sqlFiles.length > 0 && (
            <ul className="sql-files">
              {pull.sqlFiles.map((file) => (
                <li key={file.path}>
                  <a href={file.rawUrl} target="_blank" rel="noreferrer noopener">
                    {file.path.split('/').pop()}
                  </a>
                  <span className="sql-files__db">{file.database ? `acore_${file.database}` : 'database unknown'}</span>
                </li>
              ))}
            </ul>
          )}

          <ol className="commands">
            {steps.map((step) => (
              <li key={step.title} className="commands__step">
                <p className="commands__title">{step.title}</p>
                {step.commands && step.commands.length > 0 && (
                  <div className="code">
                    <pre>
                      <code>{step.commands.join('\n')}</code>
                    </pre>
                    <CopyButton text={step.commands.join('\n')} />
                  </div>
                )}
                {step.note && (
                  <p className="commands__note">
                    <InlineText text={step.note} />
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="step__source">
            Steps from the wiki:{' '}
            <a href={guide} target="_blank" rel="noreferrer noopener">
              {pull.kind === 'sql-only' ? 'How to test DB only changes' : 'How to test a PR'}
            </a>
            .
          </p>
        </li>

        <li className="step">
          <h3 className="step__title">Post your report</h3>
          <div className="reports-block">
            <p className="field__label">Already posted</p>
            <Reports pull={pull} />
            {pull.reports && pull.reports.length > 0 && (
              <p className="step__source">Another report on a different setup still helps the maintainers.</p>
            )}
          </div>
          <label className="field field--inline">
            <span className="field__label">Your OS</span>
            <input
              type="text"
              placeholder="Windows 11, Ubuntu 24.04…"
              value={prefs.os}
              onChange={(event) => onPrefsChange({ ...prefs, os: event.target.value })}
            />
          </label>
          <ReportForm key={pull.number} pull={pull} repository={repository} setup={prefs.setup} os={prefs.os} />
        </li>
      </ol>
    </article>
  );
}
