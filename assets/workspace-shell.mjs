import {VIEWS, parseWorkspaceRoute, workspaceHash} from './workspace-state.mjs';

const $ = (selector) => document.querySelector(selector);
const query = $('#q'), activity = $('#personaState'), stage = $('#sysEnvs');
let route = parseWorkspaceRoute(location.hash), layout = 'grid';
try { layout = localStorage.getItem('personaos.workspace.layout') === 'list' ? 'list' : 'grid'; } catch {}
const show = (element, visible) => { if (element && element.hidden === visible) element.hidden = !visible; };
const setText = (selector, value) => { const element = $(selector); if (element && element.textContent !== String(value)) element.textContent = value; };
const number = (key, fallback) => stage.dataset[key] === undefined ? fallback : Number(stage.dataset[key]);

function sync() {
  const people = [...stage.querySelectorAll('.persona-section:not(.offline-history-section) .pcard')];
  const spaces = [...stage.querySelectorAll('.environment-section:not(.offline-history-section) .env-card')];
  const shownPeople = people.filter(el => el.style.display !== 'none').length;
  const shownSpaces = spaces.filter(el => el.style.display !== 'none').length;
  const tasks = Number($('#missions').dataset.total || $('#missionCards').querySelectorAll('.mcard').length);
  const hasWork = !$('#missions').hidden || !$('#openInputs').hidden;
  const ready = stage.dataset.discoveryReady === 'true';
  const hasFilters = !!query.value.trim() || (['overview', 'personas'].includes(route.view) && activity.value !== 'all')
    || $('#networkAll').getAttribute('aria-pressed') === 'false';
  setText('#metric-personas', number('personaTotal', people.length || (ready ? 0 : '—')));
  setText('#metric-working', number('workingTotal', ready ? people.filter(el => el.classList.contains('running')).length : '—'));
  setText('#metric-workspaces', number('environmentTotal', spaces.length || (ready ? 0 : '—')));
  setText('#metric-tasks', tasks || (ready ? 0 : '—'));
  show($('#clearSearch'), !!query.value);
  show($('#resetFilters'), hasFilters);
  show($('#workEmpty'), route.view === 'work' && !hasWork);
  const matches = route.view === 'workspaces' ? shownSpaces : shownPeople;
  const kind = route.view === 'workspaces' ? 'workspaces' : 'personas';
  const total = route.view === 'workspaces' ? number('environmentMatched', shownSpaces) : number('personaMatched', shownPeople);
  setText('#resultSummary', ready || people.length || spaces.length
    ? `${matches} of ${total} ${kind}${hasFilters ? ' matching your filters' : ' · ordered by activity'}`
    : 'Looking for published personas and workspaces…');
  const empty = ['personas', 'workspaces', 'overview'].includes(route.view) && ready && !matches
    && (route.view !== 'overview' || !shownSpaces)
    && (hasFilters || (route.view !== 'overview' && (people.length || spaces.length)));
  show($('#viewEmpty'), empty);
  document.body.classList.toggle('filtered-empty', empty);
  if (empty) {
    setText('#viewEmptyTitle', hasFilters ? `No matching ${kind}` : `No ${kind} published yet`);
    setText('#viewEmptyText', hasFilters ? 'Try another search, activity filter, or node. Your other views are still available.'
      : `This node has not published any ${kind} yet. They will appear automatically when available.`);
    show($('#viewEmpty [data-reset-filters]'), hasFilters);
  }
}

function applyRoute({focus = false} = {}) {
  const config = VIEWS[route.view];
  if (focus) {
    if ($('#detailwrap').classList.contains('open')) $('#detailclose').click();
    if ($('#logmodal').classList.contains('open')) $('#logclose').click();
  }
  if (document.body.dataset.view !== route.view) {
    $('#missions').open = route.view === 'work';
    $('#openInputs').open = route.view === 'work';
  }
  document.body.dataset.view = route.view;
  document.title = `AI Personas · ${config.title}`;
  setText('#pageTitle', config.title); setText('#breadcrumbView', config.title);
  setText('#pageDescription', config.description);
  document.querySelectorAll('[data-panel]').forEach(el => show(el, el.dataset.panel.split(' ').includes(route.view)));
  document.querySelectorAll('.app-nav [data-view-link]').forEach(el => {
    if (el.dataset.viewLink === route.view) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  if (query.value !== route.query) {
    query.value = route.query;
    query.dispatchEvent(new Event('input', {bubbles: true}));
  }
  activity.value = ['overview', 'personas'].includes(route.view) ? route.activity : 'all';
  stage.dataset.activityFilter = activity.value;
  document.dispatchEvent(new CustomEvent('workspace:filter', {detail: {activity: activity.value}}));
  sync();
  if (focus) { $('#main').focus({preventScroll: true}); window.scrollTo({top: 0, behavior: 'instant'}); }
}
function navigate(view, activityFilter) {
  route = {...route, view, query: query.value, activity: activityFilter || activity.value};
  const hash = workspaceHash(route);
  if (location.hash !== hash) history.pushState(null, '', hash);
  applyRoute({focus: true});
}
function resetFilters() {
  query.value = ''; activity.value = 'all';
  route = {...route, query: '', activity: 'all'};
  history.replaceState(null, '', workspaceHash(route));
  query.dispatchEvent(new Event('input', {bubbles: true}));
  $('#networkAll').click(); applyRoute(); query.focus();
}
function setLayout(value) {
  layout = value; document.body.dataset.layout = layout;
  document.querySelectorAll('button[data-layout]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.layout === layout)));
  try { localStorage.setItem('personaos.workspace.layout', layout); } catch {}
}

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view-link]');
  if (nav && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
    event.preventDefault(); navigate(nav.dataset.viewLink, nav.dataset.activityFilter); return;
  }
  if (event.target.closest('[data-help]')) { $('#helpbtn').click(); $('#intro').scrollIntoView({block:'nearest'}); }
  if (event.target.closest('[data-connect-node]')) $('#opbtn').click();
  if (event.target.closest('[data-reset-filters],#resetFilters')) resetFilters();
  const mode = event.target.closest('button[data-layout]');
  if (mode) setLayout(mode.dataset.layout);
});
$('#clearSearch').addEventListener('click', () => { query.value = ''; query.dispatchEvent(new Event('input', {bubbles: true})); query.focus(); });
query.addEventListener('input', () => {
  route = {...route, query: query.value};
  history.replaceState(null, '', workspaceHash(route)); sync();
});
activity.addEventListener('change', () => {
  route.activity = activity.value; stage.dataset.activityFilter = activity.value;
  history.replaceState(null, '', workspaceHash(route));
  document.dispatchEvent(new CustomEvent('workspace:filter', {detail: {activity: activity.value}})); sync();
});
window.addEventListener('hashchange', () => { if (location.hash === '#main') return; route = parseWorkspaceRoute(location.hash); applyRoute({focus: true}); });
document.addEventListener('keydown', event => {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey
    || event.target.closest('input,textarea,select,[contenteditable="true"]')
    || $('.drawer-wrap.open,.logmodal.open')) return;
  event.preventDefault();
  query.focus();
});
let scheduled = false;
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true; queueMicrotask(() => { scheduled = false; sync(); });
});
for (const el of [stage, $('#missionCards'), $('#openInputCards'), $('#globalKernels')])
  observer.observe(el, {childList: true, subtree: true, characterData: true});
for (const el of [$('#missions'), $('#openInputs'), $('#networkAll')])
  observer.observe(el, {attributes: true, attributeFilter: ['hidden', 'aria-pressed']});
document.addEventListener('workspace:updated', sync);
setLayout(layout); applyRoute();
