// Keep the live stage's cards and controls mounted while their content changes.
// Keys are local to each parent: entity IDs distinguish cards; markup classes
// distinguish their sections. Repeated unkeyed siblings retain their order.
function nodeKey(node) {
  if (node.nodeType !== 1) return String(node.nodeType);
  const attr = (name) => node.getAttribute(name);
  let key;
  if (node.id) key = ['id', node.id];
  else if (node.hasAttribute('data-stage-key')) key = ['stage', attr('data-stage-key')];
  else if (node.matches('.pcard[data-pkey]')) key = ['persona', attr('data-pkey')];
  else if (node.matches('.env-card[data-envsid]'))
    key = ['environment', attr('data-envkernel'), attr('data-envsid')];
  else if (node.matches('.pc-avatar[data-avatar-key]'))
    key = ['avatar', attr('data-avatar-key'), attr('data-avatar-revision')];
  else if (node.hasAttribute('data-disclosure-key'))
    key = ['disclosure', attr('data-disclosure-key')];
  else if (node.matches('button,a,[role="button"]')) {
    const bindings = [...node.attributes].filter(({name}) => name.startsWith('data-'))
      .map(({name, value}) => [name, value]).sort(([a], [b]) => a.localeCompare(b));
    key = ['control', bindings.length ? null : attr('class'), attr('href'), bindings];
  } else key = ['section', attr('class')];
  return JSON.stringify([node.namespaceURI, node.localName, key]);
}

function updateNode(current, next) {
  if (current.nodeType !== 1) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  // Hydration owns this subtree after signature/hash checks. A changed persona,
  // descriptor, signing key or provider changes its key and replaces the mount.
  if (current.matches('.pc-avatar[data-avatar-key]')
      && current.getAttribute('data-avatar-revision')) return;
  const viewerAttribute = (name) => current.localName === 'details' && name === 'open';
  for (const {name} of [...current.attributes])
    if (!viewerAttribute(name) && !next.hasAttribute(name)) current.removeAttribute(name);
  for (const {name, value, namespaceURI} of next.attributes)
    if (!viewerAttribute(name) && current.getAttribute(name) !== value)
      current.setAttributeNS(namespaceURI, name, value);
  updateChildren(current, next);
}

function updateChildren(parent, next) {
  const available = new Map();
  for (const child of parent.childNodes) {
    const key = nodeKey(child);
    if (!available.has(key)) available.set(key, []);
    available.get(key).push(child);
  }
  let cursor = parent.firstChild;
  for (const child of next.childNodes) {
    const bucket = available.get(nodeKey(child));
    let current = bucket?.shift();
    if (current) updateNode(current, child);
    else current = child.cloneNode(true);
    if (current !== cursor) {
      if (parent.moveBefore && current.parentNode === parent) parent.moveBefore(current, cursor);
      else parent.insertBefore(current, cursor);
    }
    cursor = current.nextSibling;
  }
  for (const bucket of available.values()) for (const child of bucket) child.remove();
}

export function updateStageHTML(host, html) {
  if (host.dataset.h === html) return;
  const template = host.ownerDocument.createElement('template');
  template.innerHTML = html;
  const focused = host.contains(host.ownerDocument.activeElement)
    ? host.ownerDocument.activeElement : null;
  updateChildren(host, template.content);
  // Older browsers detach moved elements briefly when insertBefore reorders a
  // deck. Restore a surviving control's focus without jumping the viewport.
  if (focused?.isConnected && host.ownerDocument.activeElement !== focused)
    focused.focus({preventScroll: true});
  host.dataset.h = html;
}
