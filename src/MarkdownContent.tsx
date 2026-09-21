import { createElement, type ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { Lexer, type Token, type Tokens } from 'marked';

// Render tokens as Preact nodes, never as HTML. Authored HTML stays text, and
// images stay links so merely reading a record cannot contact an outside host.
function safeLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}
function decoded(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (raw, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (named[entity]) return named[entity];
    const n = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw;
  });
}
function nodes(tokens: Token[], depth = 0): ComponentChildren {
  if (depth > 40) return tokens.map(t => t.raw).join('');
  return tokens.map((token, i) => {
    const children = () => nodes('tokens' in token ? token.tokens || [] : [], depth + 1);
    switch (token.type) {
      case 'space': case 'def': return null;
      case 'heading': return createElement('h' + Math.min(6, token.depth + 2), { key: i }, children());
      case 'paragraph': return <p key={i}>{children()}</p>;
      case 'text': return token.tokens ? children() : decoded(token.text);
      case 'escape': return decoded(token.text);
      case 'html': return token.text;
      case 'strong': return <strong key={i}>{children()}</strong>;
      case 'em': return <em key={i}>{children()}</em>;
      case 'del': return <del key={i}>{children()}</del>;
      case 'br': return <br key={i}/>;
      case 'hr': return <hr key={i}/>;
      case 'code': return <pre key={i}><code>{token.text}</code></pre>;
      case 'codespan': return <code key={i}>{decoded(token.text)}</code>;
      case 'blockquote': return <blockquote key={i}>{children()}</blockquote>;
      case 'list': {
        const list = token as Tokens.List;
        const items = list.items.map((item, n) => <li key={n}>
          {item.task && <span class="reader-task" aria-label={item.checked ? 'Checked' : 'Unchecked'}>{item.checked ? '☑' : '☐'} </span>}
          {nodes(item.tokens, depth + 1)}</li>);
        return list.ordered ? <ol key={i} start={Number(list.start) || 1}>{items}</ol> : <ul key={i}>{items}</ul>;
      }
      case 'table': {
        const table = token as Tokens.Table;
        return <div class="reader-table" key={i} tabIndex={0} role="region" aria-label="Document table"><table>
          <thead><tr>{table.header.map((cell, n) => <th key={n} scope="col" style={{ textAlign: table.align[n] || 'left' }}>{nodes(cell.tokens, depth + 1)}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, n) => <tr key={n}>{row.map((cell, c) => <td key={c} style={{ textAlign: table.align[c] || 'left' }}>{nodes(cell.tokens, depth + 1)}</td>)}</tr>)}</tbody>
        </table></div>;
      }
      case 'link': case 'image': {
        const href = safeLink(decoded(token.href));
        const label = token.type === 'image' ? `Image: ${decoded(token.text) || 'Open image'}` : children();
        return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer">{label}</a> : <span key={i}>{label}</span>;
      }
      default: return token.raw;
    }
  });
}
export default function MarkdownContent({ text, title }: { text: string; title?: string }) {
  const content = useMemo(() => {
    try {
      const tokens = Lexer.lex(text, { gfm: true });
      const first = tokens.findIndex(token => token.type !== 'space');
      if (title && first >= 0 && tokens[first].type === 'heading' && (tokens[first] as Tokens.Heading).text.trim() === title.trim()) tokens.splice(first, 1);
      return nodes(tokens);
    }
    catch { return <p class="reader-plain">{text}</p>; }
  }, [text, title]);
  return <div class="reader-prose">{content}</div>;
}
