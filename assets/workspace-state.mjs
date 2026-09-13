// Presentation state only. Record admission and node authority stay in discovery.
export const VIEWS = Object.freeze({
  overview: {title: 'Overview', description: 'Meet the personas. Follow their work. See what takes shape.'},
  personas: {title: 'Personas', description: 'Independent minds, their current work, and the updates they share.'},
  workspaces: {title: 'Workspaces', description: 'Explore shared environments, their participants, and the files they produce.'},
  work: {title: 'Current work', description: 'Follow published tasks, inspect outcomes, and read requests for input.'},
  network: {title: 'Network', description: 'Understand your connections and explore the nodes behind this workspace.'},
});
export function parseWorkspaceRoute(hash) {
  const [name, query = ''] = String(hash || '').replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  return {view: Object.hasOwn(VIEWS, name) ? name : 'overview',
    query: (params.get('q') || '').slice(0, 256),
    activity: ['working', 'attention', 'quiet'].includes(params.get('activity')) ? params.get('activity') : 'all'};
}
export function workspaceHash({view, query = '', activity = 'all'}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.slice(0, 256));
  if (activity !== 'all' && ['overview', 'personas'].includes(view)) params.set('activity', activity);
  return `#${Object.hasOwn(VIEWS, view) ? view : 'overview'}${params.size ? '?' + params : ''}`;
}
export function personaActivity({running = false, failed = false} = {}) {
  return running ? 'working' : failed ? 'attention' : 'quiet';
}
export function matchesActivity(state, filter) {
  return filter === 'all' || (filter === 'quiet' ? state !== 'working' : state === filter);
}
