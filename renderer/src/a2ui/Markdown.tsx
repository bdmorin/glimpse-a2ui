// Markdown rendering for Text content. react-markdown + remark-gfm gives
// us bold/italic/lists/links/tables/strikethrough/etc. with safe DOM
// output (every node passes through the components map below). Code
// fences with diff language get line-by-line color tinting; other
// languages render as a plain charcoal-styled pre block.

import { Fragment, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { lowlight } from './highlight';

// Walk a lowlight (hast) tree into React elements. Every span comes
// through React's normal element pipeline — no innerHTML, no XSS.
type HastElement = {
  type: 'element';
  tagName: string;
  properties?: { className?: string | string[] };
  children: HastNode[];
};
type HastText = { type: 'text'; value: string };
type HastRoot = { type: 'root'; children: HastNode[] };
type HastNode = HastElement | HastText | HastRoot;

const renderHast = (node: HastNode, key: number | string): ReactNode => {
  if (node.type === 'text') return node.value;
  const children = node.children.map((c, i) => renderHast(c, i));
  if (node.type === 'root') return <Fragment key={key}>{children}</Fragment>;
  const cn = node.properties?.className;
  const className = Array.isArray(cn) ? cn.join(' ') : cn;
  return (
    <span key={key} className={className}>
      {children}
    </span>
  );
};

const highlightToReact = (code: string, lang: string | undefined): ReactNode => {
  const langSet = lowlight.listLanguages();
  if (lang && langSet.includes(lang)) {
    const tree = lowlight.highlight(lang, code);
    return renderHast(tree as unknown as HastNode, 'hljs-root');
  }
  return code;
};

const renderDiffLines = (source: string) => {
  const lines = source.replace(/\n$/, '').split('\n');
  return lines.map((line, i) => {
    let cls = 'block px-2 -mx-2';
    if (line.startsWith('@@')) {
      cls += ' text-voltage';
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      cls += ' text-muted-foreground font-semibold';
    } else if (line.startsWith('+')) {
      cls += ' bg-spark/15 text-spark';
    } else if (line.startsWith('-')) {
      cls += ' bg-destructive/15 text-destructive';
    } else {
      cls += ' text-foreground';
    }
    return (
      <span key={i} className={cls} style={{ display: 'block' }}>
        {line || ' '}
      </span>
    );
  });
};

const components: Components = {
  h1: ({ children }) => <h1 className="text-xl font-semibold tracking-tight mt-2 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold tracking-tight mt-2 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold uppercase tracking-wider mt-2 mb-1 text-muted-foreground">{children}</h4>,
  p: ({ children }) => <p className="leading-relaxed my-1">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="border-border my-3" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-voltage pl-3 italic text-muted-foreground my-2">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-voltage underline-offset-2 hover:underline">{children}</a>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border bg-input px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className ?? '');
    const lang = match?.[1];
    const source = String(children ?? '').replace(/\n$/, '');
    // Inline code (no language, no newline) — voltage chip.
    if (!lang && !source.includes('\n')) {
      return (
        <code
          className="rounded border border-border px-1.5 py-0.5 text-[0.92em] font-mono"
          style={{
            background: 'color-mix(in oklab, var(--color-voltage) 20%, var(--color-paper))',
            color: 'var(--color-voltage)',
          }}
        >
          {source}
        </code>
      );
    }
    if (lang === 'diff') {
      return (
        <pre className="rounded-md border border-border bg-input py-2 px-0 overflow-x-auto text-xs leading-relaxed font-mono">
          <code className="block">{renderDiffLines(source)}</code>
        </pre>
      );
    }
    return (
      <pre className="rounded-md border border-border bg-input p-3 overflow-x-auto text-xs leading-relaxed font-mono">
        <code className={'hljs block' + (lang ? ' language-' + lang : '')}>
          {highlightToReact(source, lang)}
        </code>
      </pre>
    );
  },
};

export const Markdown = ({ source }: { source: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
    {source}
  </ReactMarkdown>
);
