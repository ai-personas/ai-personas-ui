import { useEffect, useRef, useState } from 'preact/hooks';
import { request } from './api';

/** Read existing output only. Visibility never starts, resumes, or cancels a job. */
export default function ToolOutput({ id, state, visible = true }: { id: string; state: string; visible?: boolean }) {
  const [body, setBody] = useState(''), [done, setDone] = useState(false), [error, setError] = useState('');
  const offset = useRef(0), output = useRef<HTMLPreElement>(null), following = useRef(true);
  useEffect(() => { offset.current = 0; setBody(''); setDone(false); setError(''); }, [id]);
  useEffect(() => {
    if (!visible) return;
    const c = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const r = await request<{ text: string; offset: number; receipt?: { done?: boolean } }>(`/actions/${id}/output?offset=${offset.current}&limit=32768`, { signal: c.signal });
        if (c.signal.aborted) return;
        const advanced = r.offset - offset.current;
        offset.current = r.offset; setBody(t => (t + r.text).slice(-65536));
        const finished = (!!r.receipt?.done || state !== 'running') && advanced < 32768;
        setDone(finished); setError('');
        if (!finished) timer = setTimeout(load, advanced === 32768 ? 0 : 350);
      } catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    };
    void load(); return () => { c.abort(); clearTimeout(timer); };
  }, [id, state, visible]);
  useEffect(() => { if (following.current && output.current) output.current.scrollTop = output.current.scrollHeight; }, [body]);
  return <section class="tool-output" aria-label="Tool output">
    {error && <p role="alert">Output unavailable: {error}</p>}
    <pre ref={output} class="output" tabIndex={0} onScroll={e => { const el = e.currentTarget; following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>{body || (done ? 'No text output was recorded.' : 'Waiting for tool output…')}</pre>
    <small>{done ? `Recorded output shown. Action status: ${state}; inspect its receipt for the outcome.` : visible ? 'Following tool output.' : 'Live view paused.'} Showing up to the latest 65,536 characters.</small>
  </section>;
}
