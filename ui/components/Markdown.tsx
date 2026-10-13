import { Fragment, type ReactNode } from "react";

/*
 * Tiny, safe Markdown renderer for text that comes from the API (report sections, LLM explanations).
 * Supports: headings, bullet/numbered lists, tables, blockquotes, **bold**, *italic*, `code`, <br>.
 * It never injects raw HTML, so API text cannot add markup.
 */

const INLINE = /(`[^`]+`)|(\*\*[^*]+?\*\*)|(\*[^*\s][^*]*?\*)|(<br\s*\/?>)/g;

export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    const k = `i${i++}`;
    if (m[1]) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}><Inline text={tok.slice(2, -2)} /></strong>);
    else if (m[3]) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else out.push(<br key={k} />);
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Remove Markdown emphasis markers; used when only plain text is needed (classification, aria labels). */
export function stripMd(text: string): string {
  return text.replace(/\*\*/g, "").replace(/`/g, "").replace(/<br\s*\/?>/gi, " ").trim();
}

const isTableLine = (l: string) => l.trim().startsWith("|");
const isSep = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
const bulletRe = /^\s*(?:[-*•]|\d+[.)])\s+/;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-4 border-line" />);
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const Tag = h[1].length <= 3 ? "h3" : "h4";
      blocks.push(<Tag key={key++}><Inline text={h[2]} /></Tag>);
      i++;
      continue;
    }
    if (isTableLine(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableLine(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div className="table-wrap" key={key++}>
          <table>
            <thead>
              <tr>{head.map((c, j) => <th key={j}><Inline text={c} /></th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, j) => (
                <tr key={j}>{r.map((c, k) => <td key={k}><Inline text={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (bulletRe.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && lines[i].trim() && (bulletRe.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (bulletRe.test(lines[i])) items.push(lines[i].replace(bulletRe, ""));
        else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      const L = ordered ? "ol" : "ul";
      blocks.push(
        <L key={key++}>
          {items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
        </L>,
      );
      continue;
    }
    if (line.trimStart().startsWith(">")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={key++}><Inline text={q.join(" ")} /></blockquote>);
      continue;
    }
    const para: string[] = [lines[i++].trim()]; // always consume the first line (prevents an endless loop)
    while (
      i < lines.length &&
      lines[i].trim() &&
      !bulletRe.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !isTableLine(lines[i]) &&
      !lines[i].trimStart().startsWith(">")
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push(<p key={key++}><Inline text={para.join(" ")} /></p>);
  }

  return (
    <div className={`md ${className}`}>
      {blocks.map((b, j) => <Fragment key={j}>{b}</Fragment>)}
    </div>
  );
}
