import { lazy, Suspense } from 'preact/compat';
import { useErrorBoundary } from 'preact/hooks';
import { fileFormat, MAX_ARCHIVE_DEPTH, type PreviewFile } from './formats';
import { engineeringAdvice } from './engineering';

const MarkdownPreview = lazy(() => import('./MarkdownPreview'));
const ImagePreview = lazy(() => import('./ImagePreview'));
const TextPreview = lazy(() => import('./TextPreview'));
const ArchivePreview = lazy(() => import('./ArchivePreview'));
const MediaPreview = lazy(() => import('./MediaPreview'));
const PdfPreview = lazy(() => import('./PdfPreview'));
const ModelPreview = lazy(() => import('./ModelPreview'));
const EngineeringPreview = lazy(() => import('./EngineeringPreview'));
const TablePreview = lazy(() => import('./TablePreview'));

/** Only the selected renderer is mounted. No hidden preview cache retains blobs,
 * media elements, object URLs or archive workers after navigating away. */
export default function FilePreview({ file, depth = 0 }: { file: PreviewFile; depth?: number }) {
  const [error] = useErrorBoundary(), format = fileFormat(file.name, file.media);
  if (error) return <p role="alert">The preview could not be loaded. Close and reopen this file to try again, or download the original.</p>;
  const props = { file: { ...file, media: ['text', 'markdown', 'table', 'engineering'].includes(format.kind) ? file.media : format.media } };
  return <div class="file-preview" data-format={format.kind}><Suspense fallback={<p role="status">Loading {format.label.toLowerCase()} preview…</p>}>
    {format.kind === 'markdown' ? <MarkdownPreview {...props}/> : format.kind === 'image' ? <ImagePreview {...props}/>
      : format.kind === 'text' ? <>{engineeringAdvice(file.name) && <p class="notice">{engineeringAdvice(file.name)}</p>}<TextPreview {...props}/></> : format.kind === 'pdf' ? <PdfPreview {...props}/>
      : format.kind === 'engineering' ? <EngineeringPreview {...props}/>
      : format.kind === 'model' ? <ModelPreview {...props}/> : format.kind === 'table' ? <TablePreview {...props}/>
      : format.kind === 'audio' || format.kind === 'video' ? <MediaPreview {...props}/>
      : format.kind === 'archive' && depth < MAX_ARCHIVE_DEPTH ? <ArchivePreview {...props} depth={depth}/>
      : <p class="notice">{format.kind === 'archive' ? 'Download this nested archive to browse deeper folders.' : 'A preview is not available for this format. ' + (engineeringAdvice(file.name) || 'Download this file to open it in its application.')}</p>}
  </Suspense></div>;
}
