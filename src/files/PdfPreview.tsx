import { useObjectURL } from './useObjectURL';
import type { PreviewFile } from './formats';

export default function PdfPreview({ file }: { file: PreviewFile }) {
  const url = useObjectURL(file.blob, 'application/pdf');
  return <>{url && <object class="file-pdf" data={url} type="application/pdf" aria-label={file.name}>
    <p>Your browser cannot display this PDF. Use the download button to open it.</p>
  </object>}</>;
}
