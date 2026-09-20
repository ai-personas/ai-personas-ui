import { useEffect, useRef, useState } from 'preact/hooks';
import type { Ref } from 'preact';

/** Keep keystrokes local. Only a settled query invalidates the record collection. */
export default function SearchInput({ value, onSearch, label, placeholder, inputRef }: {
  value: string; onSearch: (query: string) => void; label: string; placeholder?: string; inputRef?: Ref<HTMLInputElement>;
}) {
  const [draft, setDraft] = useState(value);
  const emitted = useRef(value), callback = useRef(onSearch);
  callback.current = onSearch;
  useEffect(() => { if (value !== emitted.current) { emitted.current = value; setDraft(value); } }, [value]);
  useEffect(() => {
    if (draft === emitted.current) return;
    const timer = setTimeout(() => { emitted.current = draft; callback.current(draft); }, 250);
    return () => clearTimeout(timer);
  }, [draft]);
  return <><input ref={inputRef} type="search" aria-label={label} placeholder={placeholder} value={draft} onInput={e => setDraft(e.currentTarget.value)}/>
    {draft && <button type="button" class="clear-search" aria-label="Clear search" onClick={e => {
      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
      setDraft(''); emitted.current = ''; callback.current(''); input.focus();
    }}>×</button>}</>;
}
