"use client";

import { ReactNode } from "react";

type Props = {
  text: string;
  onCopy: (value: string, detail?: string) => void | Promise<void>;
};

function inlineMarkdown(value: string, keyPrefix: string): ReactNode[] {
  const matcher = /(`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\*[^*\n]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<]+)/g;
  const output: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(value))) {
    if (match.index > cursor) output.push(value.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("`") && token.endsWith("`")) {
      output.push(<code className="inline-code" key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      output.push(<strong key={key}>{inlineMarkdown(token.slice(2, -2), `${key}-strong`)}</strong>);
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      output.push(<del key={key}>{inlineMarkdown(token.slice(2, -2), `${key}-del`)}</del>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      output.push(<em key={key}>{inlineMarkdown(token.slice(1, -1), `${key}-em`)}</em>);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)]\((https?:\/\/[^\s)]+)\)$/);
      if (link) output.push(<a key={key} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>);
    } else {
      output.push(<a key={key} href={token} target="_blank" rel="noreferrer">{token}</a>);
    }
    cursor = matcher.lastIndex;
  }

  if (cursor < value.length) output.push(value.slice(cursor));
  return output;
}

function isTableDivider(value: string) {
  const cells = value.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function tableCells(value: string) {
  return value.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function proseBlocks(value: string, keyPrefix: string): ReactNode[] {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s*(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = inlineMarkdown(heading[2], `${keyPrefix}-h-${index}`);
      if (level === 1) blocks.push(<h1 key={`${keyPrefix}-${index}`}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 key={`${keyPrefix}-${index}`}>{content}</h2>);
      else if (level === 3) blocks.push(<h3 key={`${keyPrefix}-${index}`}>{content}</h3>);
      else blocks.push(<h4 key={`${keyPrefix}-${index}`}>{content}</h4>);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`${keyPrefix}-hr-${index}`} />);
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quote.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={`${keyPrefix}-quote-${index}`}>{quote.map((item, quoteIndex) => <p key={quoteIndex}>{inlineMarkdown(item, `${keyPrefix}-quote-${index}-${quoteIndex}`)}</p>)}</blockquote>);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push(<ul key={`${keyPrefix}-ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, `${keyPrefix}-ul-${index}-${itemIndex}`)}</li>)}</ul>);
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push(<ol key={`${keyPrefix}-ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, `${keyPrefix}-ol-${index}-${itemIndex}`)}</li>)}</ol>);
      continue;
    }

    if (trimmed.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = tableCells(trimmed);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="markdown-table-wrap" key={`${keyPrefix}-table-${index}`}>
          <table>
            <thead><tr>{headers.map((header, cellIndex) => <th key={cellIndex}>{inlineMarkdown(header, `${keyPrefix}-th-${cellIndex}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{inlineMarkdown(row[cellIndex] || "", `${keyPrefix}-td-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const paragraph: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,6})\s*/.test(next) || /^[-*+]\s+/.test(next) || /^\d+[.)]\s+/.test(next) || next.startsWith(">") || /^(-{3,}|\*{3,}|_{3,})$/.test(next)) break;
      if (next.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push(<p key={`${keyPrefix}-p-${index}`}>{paragraph.map((part, partIndex) => <span key={partIndex}>{inlineMarkdown(part, `${keyPrefix}-p-${index}-${partIndex}`)}{partIndex < paragraph.length - 1 && <br />}</span>)}</p>);
  }

  return blocks;
}

export default function MarkdownMessage({ text, onCopy }: Props) {
  const blocks: ReactNode[] = [];
  const fence = /```(?:([a-zA-Z0-9_+.-]+)\n)?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text))) {
    if (match.index > cursor) blocks.push(...proseBlocks(text.slice(cursor, match.index), `prose-${cursor}`));
    const language = match[1] || "code";
    const code = match[2].replace(/^\n/, "").replace(/\n$/, "");
    blocks.push(
      <section className="code-block" key={`code-${match.index}`}>
        <header><span>{language}</span><button type="button" onClick={() => void onCopy(code, "Code copied")}>Copy code</button></header>
        <pre><code>{code}</code></pre>
      </section>,
    );
    cursor = fence.lastIndex;
  }

  if (cursor < text.length) blocks.push(...proseBlocks(text.slice(cursor), `prose-${cursor}`));
  if (!blocks.length && text) blocks.push(...proseBlocks(text, "prose-empty"));

  return <div className="markdown-body">{blocks}</div>;
}
