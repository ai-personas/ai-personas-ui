import { useMemo, useState } from 'preact/hooks';
import { fileFormat, type PreviewFile } from './formats';
import { useText } from './useText';
import { parseDelimited, type Delimited } from './delimited';
import './extended-preview.css';

export default function TablePreview({ file }: { file: PreviewFile }) {
  const { text, error, truncated } = useText(file.blob, file.media);
  const [source, setSource] = useState(false);
  const delimiter = fileFormat(file.name, file.media).media === 'text/tab-separated-values' ? '\t' : ',';
  const parsed = useMemo<{ table?: Delimited; error?: string }>(() => {
    if (text === undefined) return {};
    try { return { table: parseDelimited(text, delimiter, truncated) }; } catch (error) { return { error: error instanceof Error ? error.message : 'Could not read the table.' }; }
  }, [text, delimiter, truncated]);
  if (error) return <p role="alert">{error}</p>;
  if (text === undefined) return <p role="status">Reading table…</p>;
  const rows = parsed.table?.rows ?? [], columns = Math.max(0, ...rows.map(row => row.length));
  return <section class="table-preview" aria-label={`Table preview of ${file.name}`}>
    <button class="secondary" aria-pressed={source} onClick={() => setSource(value => !value)}>{source ? 'Show table' : 'Show source'}</button>
    {(truncated || parsed.table?.truncated) && <p class="notice">Partial preview: up to 128 KiB, 500 rows and 50 columns. An incomplete last row is omitted. Download the original for all data.</p>}
    {source ? <pre class="file-source">{text}</pre> : parsed.error ? <p role="alert">{parsed.error}</p> : rows.length ? <div class="file-table-scroll" tabIndex={0} role="region" aria-label="Scrollable file data">
      <table><caption>{file.name} · {rows.length} displayed rows. Row 1 is preserved as data; headers are not inferred.</caption>
        <thead><tr><th scope="col">Row</th>{Array.from({ length: columns }, (_, i) => <th key={i} scope="col">Column {i + 1}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}><th scope="row">{i + 1}</th>{Array.from({ length: columns }, (_, j) => <td key={j}>{row[j] ?? ''}</td>)}</tr>)}</tbody>
      </table></div> : <p class="notice">No complete rows to display.</p>}
  </section>;
}
