import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders text taken from a PR description. Raw HTML is dropped (never
 * rendered), and links open in a new tab.
 */
export function Markdown({ children, repository }: { children: string; repository: string }) {
  // Turn bare "#1234" references into links, as GitHub does.
  const linked = children.replace(/(^|[\s(])#(\d{2,6})\b/g, `$1[#$2](https://github.com/${repository}/issues/$2)`);
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {linked}
      </ReactMarkdown>
    </div>
  );
}
