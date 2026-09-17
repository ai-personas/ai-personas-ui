import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/** Native top-layer modal: inert background, nested dialogs, Escape and focus return. */
export default function Dialog({ label, close, children, drawer = false }: {
  label: string; close: () => void; children: ComponentChildren; drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} class={`modal-root ${drawer ? 'modal-drawer' : ''}`}
    aria-label={label} onCancel={e => { e.preventDefault(); close(); }}>
    {children}
  </dialog>;
}
