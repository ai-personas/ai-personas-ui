// Synthetic frontend-only fixture. No runtime connection, credentials or live data.
import { render } from 'preact';
import ArchivePreview from '../src/files/ArchivePreview';
import InferenceEvidence from '../src/InferenceEvidence';
import { ContentCard } from '../src/ContentCards';
const root = document.getElementById('fixture')!;
const api = window as any;
api.opened = [];
const open = (id: string) => api.opened.push(id);
api.mountArchive = (encoded: string, name: string, media: string) => {
  const bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
  render(<ArchivePreview file={{blob:new Blob([bytes]),name,media}} depth={0}/>, root);
};
api.mountEvidence = (value: unknown) => render(<InferenceEvidence value={value} open={open}/>, root);
api.mountCards = () => render(<>{['document','fragment'].map((kind, i) => <ContentCard key={kind} open={open}
  record={{id:String(i).repeat(32),kind,scope:'',revision:1,created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z',data:{title:kind === 'document' ? 'Saved report' : 'Authored lesson',content:'Synthetic fixture'}}}/>)}</>, root);
api.unmount = () => render(null, root);
render(<h1>Reliability fixture ready</h1>, root);
