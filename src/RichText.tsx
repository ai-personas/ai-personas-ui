import { lazy, Suspense } from 'preact/compat';

// Record cards may be loaded without ever opening prose. Keep the Markdown
// parser out of that initial dependency graph as well as the file viewer's.
const MarkdownContent = lazy(() => import('./MarkdownContent'));
export default function RichText(props: { text: string; title?: string }) {
  return <Suspense fallback={<p class="reader-plain" role="status">Loading document…</p>}><MarkdownContent {...props}/></Suspense>;
}
