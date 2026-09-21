import MarkdownContent from '../MarkdownContent';
import type { PreviewFile } from './formats';
import { useText } from './useText';

export default function MarkdownPreview({ file }: { file: PreviewFile }) {
  const { text, error, truncated } = useText(file.blob, file.media);
  if (error) return <p role="alert">{error}</p>;
  if (text === undefined) return <p role="status">Reading document…</p>;
  return <>{truncated && <p class="notice">Showing the first 128 KB. Download this file to read the complete document.</p>}
    {text ? <MarkdownContent text={text}/> : <p>This document is empty.</p>}</>;
}
