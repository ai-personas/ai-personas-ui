// Explicit node connections live only in this tab's memory.
export class NodeReadSession {
  #nodes = new Map();
  set(base, token = '') {
    const url = new URL(String(base).trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error('Enter a node URL without credentials, a query, or a fragment.');
    if (typeof token !== 'string' || /[^\x21-\x7e]/.test(token))
      throw new Error('The node token contains invalid characters.');
    const key = url.href.replace(/\/+$/, '');
    this.#nodes.set(key, token);
    return key;
  }
  delete(base) { return this.#nodes.delete(base); }
  entries() { return [...this.#nodes.entries()]; }
  tokenFor(value) {
    let target; try { target = new URL(value); } catch (_) { return ''; }
    if (target.username || target.password) return '';
    let token = '', longest = -1;
    for (const [base, candidate] of this.#nodes) {
      const root = new URL(base), path = root.pathname.replace(/\/+$/, '');
      if (target.origin === root.origin && (!path || target.pathname === path || target.pathname.startsWith(path + '/'))
          && path.length > longest) { token = candidate; longest = path.length; }
    }
    return token;
  }
}

// EventSource cannot send an Authorization header. Fetch provides the same SSE
// event interface for public and token-authorized reads without URL credentials.
export function fetchEventSource(url, {requestInit = () => ({}), fetchImpl = globalThis.fetch,
  maxFrameBytes = 4 * 1024 * 1024, retryMs = 1000} = {}) {
  const target = new EventTarget();
  let closed = false, controller, timer, resume, lastEventId = '';
  const source = {
    readyState: 0, onerror: null,
    addEventListener: (...args) => target.addEventListener(...args),
    removeEventListener: (...args) => target.removeEventListener(...args),
    close() { closed = true; source.readyState = 2; controller?.abort(); clearTimeout(timer); resume?.(); },
  };
  function emit(type, data, error) {
    if (closed) return;
    const event = data === undefined ? new Event(type) : new MessageEvent(type, {data, lastEventId});
    if (error) event.error = error;
    target.dispatchEvent(event);
    if (type === 'error') source.onerror?.(event);
  }
  source.done = (async () => {
    await Promise.resolve(); // callers can attach handlers before the first event
    while (!closed) {
      controller = new AbortController();
      let reader;
      try {
        const response = await fetchImpl(url, {...requestInit(), method: 'GET', signal: controller.signal,
          credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store'});
        if (!response.ok) {
          const error = new Error('Node event stream unavailable');
          error.status = response.status; throw error;
        }
        if (!response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream'))
          throw new Error('Node event stream unavailable');
        reader = response.body.getReader();
        source.readyState = 1; emit('open');
        const decoder = new TextDecoder('utf-8', {fatal: true});
        let pending = '', kind = '', data = [], frameBytes = 0;
        function line(value) {
          if (!value) {
            if (data.length) emit(kind || 'message', data.join('\n'));
            kind = ''; data = []; frameBytes = 0; return;
          }
          if (value.startsWith(':')) return;
          frameBytes += new TextEncoder().encode(value).byteLength;
          if (frameBytes > maxFrameBytes) throw new Error('Node event frame too large');
          const colon = value.indexOf(':'), field = colon < 0 ? value : value.slice(0, colon);
          let body = colon < 0 ? '' : value.slice(colon + 1);
          if (body.startsWith(' ')) body = body.slice(1);
          if (field === 'data') data.push(body);
          else if (field === 'event') kind = body;
          else if (field === 'id' && !body.includes('\0')) lastEventId = body;
          else if (field === 'retry' && /^\d+$/.test(body)) retryMs = Math.max(250, Math.min(30000, Number(body)));
        }
        while (!closed) {
          const {value, done} = await reader.read();
          pending += done ? decoder.decode() : decoder.decode(value, {stream: true});
          let at;
          while ((at = pending.search(/[\r\n]/)) >= 0) {
            if (!done && pending[at] === '\r' && at + 1 === pending.length) break;
            const width = pending.slice(at, at + 2) === '\r\n' ? 2 : 1;
            line(pending.slice(0, at)); pending = pending.slice(at + width);
          }
          if (new TextEncoder().encode(pending).byteLength > maxFrameBytes)
            throw new Error('Node event line too large');
          if (done) break;
        }
        if (!closed) { source.readyState = 0; emit('error'); }
      } catch (error) {
        if (!closed) { source.readyState = 0; emit('error', undefined, error); }
      } finally {
        try { await reader?.cancel(); reader?.releaseLock(); } catch (_) {}
      }
      if (!closed) await new Promise(resolve => { resume = resolve; timer = setTimeout(resolve, retryMs); });
      resume = null;
    }
  })();
  return source;
}
