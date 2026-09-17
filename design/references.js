/* The reviewer embeds only allowlisted local fixture routes. No API connection. */
(function () {
  'use strict';
  const R = globalThis.PersonaReferenceScreens;
  const list = document.getElementById('screen-list');
  const stage = document.getElementById('stage');
  const viewport = document.getElementById('viewport');
  const status = document.getElementById('load-status');
  let current, frame;
  R.screens.forEach((screen, i) => {
    const link = document.createElement('a');
    link.className = 'screen-link';
    link.href = `#${screen.id}`;
    link.dataset.screen = screen.id;
    const index = document.createElement('span');
    index.className = 'screen-index';
    index.setAttribute('aria-hidden', 'true');
    index.textContent = String(i + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.textContent = screen.title;
    link.append(index, label);
    list.append(link);
  });
  function fit() {
    if (!frame || !current) return;
    const style = getComputedStyle(stage);
    const available = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const scale = Math.max(0, Math.min(1, available / current.width));
    viewport.style.width = `${current.width * scale}px`;
    viewport.style.height = `${current.height * scale}px`;
    frame.style.transform = `scale(${scale})`;
  }
  function render() {
    current = R.find(location.hash.slice(1));
    document.title = `${current.title} · AI Personas reference review`;
    document.getElementById('screen-number').textContent = `Reference ${R.screens.indexOf(current) + 1} of ${R.screens.length}`;
    document.getElementById('screen-title').textContent = current.title;
    document.getElementById('screen-note').textContent = current.note;
    document.getElementById('dimensions').textContent = `${current.width} × ${current.height} viewport · ${current.fullPage ? 'Full-page QA capture' : 'Viewport QA capture'}`;
    document.getElementById('open-preview').href = R.url(current);
    for (const link of list.children) {
      if (link.dataset.screen === current.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    stage.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading preview…';
    const next = document.createElement('iframe');
    next.title = `${current.title} — interactive illustrative fixture`;
    next.width = String(current.width);
    next.height = String(current.height);
    next.referrerPolicy = 'no-referrer';
    next.addEventListener('load', () => {
      if (frame !== next) return;
      stage.setAttribute('aria-busy', 'false');
      try {
        status.textContent = next.contentDocument?.querySelector('#app main')
          ? 'Preview ready · illustrative only'
          : 'Preview unavailable — open the full-size view';
      } catch {
        status.textContent = 'Preview unavailable — serve this folder locally';
      }
    }, { once: true });
    next.src = R.url(current);
    // Replacing, rather than hiding, the iframe disposes the old page and its
    // local state/listeners. Keep only one embedded fixture alive at a time.
    viewport.replaceChildren(next);
    frame = next;
    fit();
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);
  window.addEventListener('hashchange', render);
  window.addEventListener('pagehide', () => observer.disconnect());
  window.addEventListener('pageshow', () => { observer.observe(stage); fit(); });
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('review').focus({ preventScroll: true });
    document.getElementById('review').scrollIntoView({ block: 'start' });
  });
  render();
})();
