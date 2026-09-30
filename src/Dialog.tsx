import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { lockDialogScroll } from './dialog-scroll';
import './dialog.css';

/** Native top-layer modal: inert background, nested dialogs, Escape and focus return. */
export default function Dialog({ label, close, children, drawer = false }: {
  label: string; close: () => void; children: ComponentChildren; drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockDialogScroll(dialog.ownerDocument);
    try { dialog.showModal(); }
    catch (error) { unlock(); throw error; }
    return () => {
      dialog.close();
      unlock();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} class={`modal-root ${drawer ? 'modal-drawer' : ''}`}
    aria-label={label} onCancel={e => { e.preventDefault(); close(); }}>
    {children}
  </dialog>;
}
