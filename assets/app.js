const paths = {
  page: '.well-known/personaos-page-index.json',
  runIndex: '.well-known/personaos-run-index.json',
  peer: 'p2p/peer-manifest.json',
  cards: 'discovery/cards.json',
  activity: 'activity/latest.json'
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[ch]));

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

function setText(id, value) {
  document.getElementById(id).textContent = value || 'not published';
}

function link(path, label) {
  return `<a href="${encodeURI(path)}">${esc(label || path)}</a>`;
}

function renderLinks(page) {
  const entries = page.entrypoints || {};
  const labels = {
    run_index: 'Run index',
    keys: 'Public keys',
    card_catalog: 'Card catalog',
    registry: 'Registry',
    content_dag: 'Content DAG',
    telemetry_summary: 'Telemetry summary'
  };
  document.getElementById('discovery-links').innerHTML = Object.entries(labels)
    .map(([key, labelText]) => link(entries[key], labelText))
    .join('');
}

function renderArtifacts(runIndex) {
  const artifacts = (((runIndex || {}).storage || {}).artifacts || []);
  document.getElementById('artifacts').innerHTML = artifacts.map((artifact) => `
    <tr>
      <td>${link(artifact.package_path, artifact.title)}</td>
      <td>${esc(artifact.media_kind)}</td>
      <td>${esc(artifact.size_bytes)}</td>
      <td>${esc(artifact.cid)}</td>
    </tr>
  `).join('');
}

function renderMetrics(activity) {
  const telemetry = activity.telemetry || {};
  const metrics = {
    'OTel spans': telemetry.otel_spans,
    'Lineage events': telemetry.lineage_events,
    'Verified scopes': telemetry.lineage_scopes_verified,
    'Span groups': Object.keys(telemetry.span_counts || {}).length
  };
  document.getElementById('metrics').innerHTML = Object.entries(metrics)
    .map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`)
    .join('');
}

function renderActivity(activity) {
  const spans = activity.recent_spans || [];
  document.getElementById('activity').innerHTML = spans.map((span) => `
    <li>
      <time>${esc(span.ended_at || span.started_at)}</time>
      <strong>${esc(span.name)}</strong>
      <code>${esc(span.status)} | ${esc(span.trace_id)}</code>
    </li>
  `).join('');
}

async function render() {
  const [page, runIndex, activity] = await Promise.all([
    loadJson(paths.page),
    loadJson(paths.runIndex),
    loadJson(paths.activity)
  ]);
  const handles = page.handles || runIndex.handles || {};
  document.getElementById('status').textContent = activity.accepted ? 'Verified' : 'Open';
  setText('task', page.task || runIndex.task);
  setText('persona', handles.persona_id);
  setText('environment', handles.environment_id);
  setText('bundle', handles.bundle_id);
  renderLinks(page);
  renderArtifacts(runIndex);
  renderMetrics(activity);
  renderActivity(activity);
}

render().catch((error) => {
  document.getElementById('status').textContent = 'Unavailable';
  console.error(error);
});
setInterval(() => render().catch(console.error), 5000);
