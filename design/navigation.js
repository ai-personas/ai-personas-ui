/* Small, local-only navigation behaviors shared by the reference screens. */
(function () {
  'use strict';
  const skip = document.querySelector('.skip-link');
  skip?.addEventListener('click', event => {
    const main = document.getElementById('main');
    if (!main) return;
    // The application uses the hash as its router. A plain #main navigation
    // would replace the current route instead of just moving keyboard focus.
    event.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: 'start' });
  });

  // Only this explicitly allowlisted, non-authorizing fixture action may be
  // opened by a URL. Never dispatch arbitrary data-action/query values.
  if (new URLSearchParams(location.search).get('preview') === 'request' &&
      location.hash === '#/work') {
    document.querySelector('[data-action="answer"][data-id="home"]')?.click();
  }
})();
