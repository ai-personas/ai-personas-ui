/** Synthetic inputs only; mounts the production FilePreview component. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import FilePreview from '../../src/files/FilePreview';
import type { PreviewFile } from '../../src/files/formats';
import '../../src/files/viewer.css';

function Fixture() {
  const [file, setFile] = useState<PreviewFile>(), [revision, setRevision] = useState(0);
  return <main style={{ maxWidth: '1100px', margin: 'auto', padding: '16px', fontFamily: 'system-ui', overflowWrap: 'anywhere' }}>
    <h1>Production file preview fixture</h1>
    <label>Fixture file<input type="file" onChange={event => { const value = event.currentTarget.files?.[0]; if (value) { setFile({ blob: value, name: value.name, media: value.type }); setRevision(n => n + 1); } }}/></label>
    <button onClick={() => setFile(undefined)}>Clear preview</button>
    {file && <FilePreview key={revision} file={file}/>}
  </main>;
}
render(<Fixture/>, document.getElementById('app')!);
