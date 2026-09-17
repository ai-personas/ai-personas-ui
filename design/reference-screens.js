/* User reference metadata, not personas, native artifacts or runtime evidence. */
(function (root) {
  'use strict';
  const screens = Object.freeze([
    { id: 'work-desktop', title: 'Work · desktop', source: 'FINAL-DESKTOP(1).png',
      width: 1440, height: 1000, fullPage: true, route: '#/work',
      note: 'The request comes first. Activity, the latest submission and evidence remain separate.' },
    { id: 'work-mobile', title: 'Work · mobile', source: 'FINAL-MOBILE(1).png',
      width: 390, height: 1100, fullPage: false, route: '#/work',
      note: 'Work rows become compact cards. The five-item bottom navigation stays reachable.' },
    { id: 'personas', title: 'Continuing personas', source: 'FINAL-PERSONAS(1).png',
      width: 1440, height: 1000, fullPage: false, route: '#/personas',
      note: 'Character and current attention are distinct. Initials are placeholders, not generated portraits.' },
    { id: 'request-mobile', title: 'Information request · mobile', source: 'FINAL-REQUEST-MOBILE.png',
      width: 390, height: 1100, fullPage: false, route: '#/work', preview: 'request',
      note: 'An answer is not an approval or a resolution. The modal keeps background content inert and scroll locked. Capture the viewport, not the original full-page backdrop artifact.' },
    { id: 'work-detail', title: 'Work detail', source: 'FINAL-WORK-DETAIL(1).png',
      width: 1440, height: 1000, fullPage: true, route: '#/work/home',
      note: 'The supplied overview composition is retained. Six accessible detail views deliberately expose the additional Rust v1.2 perspectives, consent and evidence requirements.' },
    { id: 'workspace-desktop', title: 'Evolving work · desktop', source: 'WORKSPACE-DESKTOP.png',
      width: 1440, height: 1000, fullPage: true, route: '#/workspace/house/3',
      note: 'The WORKSPACE composition is a separate replay, not a replacement shell. Priorities are authored choices; stale evidence is not a current pass.' },
    { id: 'workspace-mobile', title: 'Evolving work · narrow mobile', source: 'WORKSPACE-MOBILE.png',
      width: 266, height: 900, fullPage: true, route: '#/workspace/house/3',
      note: 'The same replay stacks at 266 px. All tabs remain keyboard reachable; allowances include descendants and are not dollar caps.' }
  ].map(screen => Object.freeze(screen)));
  const find = id => screens.find(screen => screen.id === id) || screens[0];
  const url = screen => {
    if (!screens.includes(screen)) throw new TypeError('Unknown reference screen');
    return `index.html${screen.preview === 'request' ? '?preview=request' : ''}${screen.route}`;
  };
  const api = Object.freeze({ screens, find, url });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PersonaReferenceScreens = api;
})(globalThis);
