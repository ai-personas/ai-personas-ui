import type { PreviewFile } from './formats';
import { useText } from './useText';

export default function TextPreview({ file }: { file: PreviewFile }) {
  const { text, error, truncated } = useText(file.blob, file.media);
  if (error) return <p role="alert">{error}</p>;
  if (text === undefined) return <p role="status">Reading file…</p>;
  // Plain text, source code and JSON are files, not Markdown or record tables.
  return <>{truncated && <p class="notice">Showing the first 128 KB. Download this file for the complete contents.</p>}
    <pre class="file-source" tabIndex={0} aria-label={file.name + ' contents'}><code>{text || '(Empty file)'}</code></pre></>;
}
