type SavedProperty = { name: string; value: string; priority: string };
type ScrollLock = { count: number; saved: SavedProperty[] };
const locks = new WeakMap<Document, ScrollLock>();

/** Keep the page stationary until the last modal using this document closes. */
export function lockDialogScroll(doc: Document): () => void {
  const root = doc.documentElement;
  let lock = locks.get(doc);
  if (!lock) {
    const saved = ['overflow-x', 'overflow-y', 'scrollbar-gutter'].map(name => ({
      name, value: root.style.getPropertyValue(name), priority: root.style.getPropertyPriority(name),
    }));
    lock = { count: 0, saved };
    locks.set(doc, lock);
    // Keep an existing classic scrollbar's space without adding padding or
    // changing the layout of pages that do not have a scrollbar.
    const view = doc.defaultView;
    if (view && view.innerWidth > root.clientWidth && !(view.getComputedStyle(root).scrollbarGutter || '').includes('stable')) {
      root.style.setProperty('scrollbar-gutter', 'stable', 'important');
    }
    root.style.setProperty('overflow-x', 'hidden', 'important');
    root.style.setProperty('overflow-y', 'hidden', 'important');
  }
  lock.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lock.count) return;
    for (const { name, value, priority } of lock.saved) {
      if (value) root.style.setProperty(name, value, priority);
      else root.style.removeProperty(name);
    }
    locks.delete(doc);
  };
}
