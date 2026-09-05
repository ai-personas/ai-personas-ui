// Internal addresses for verified libp2p providers without an HTTPS origin.
// These URLs identify the data route; they never become HTTP destinations.
export function normalizedPeerRouteBase(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.username || url.password || url.search || url.hash) return '';
    if (url.protocol === 'https:') return url.href.replace(/\/$/, '');
    if (url.protocol === 'libp2p:' && !url.port
        && /^[A-Za-z0-9]+$/.test(url.hostname)
        && ['', '/'].includes(url.pathname)) return `libp2p://${url.hostname}`;
  } catch (_) { /* A malformed locator does not create a route. */ }
  return '';
}

export function providerRouteBase(provider) {
  const https = normalizedPeerRouteBase(provider?.base_url);
  if (https.startsWith('https:')) return https;
  return normalizedPeerRouteBase(`libp2p://${String(provider?.provider_peer_id || '')}`);
}

export function sameRouteOrigin(target, base) {
  // Non-HTTP URLs have the same opaque `null` origin. Compare their concrete
  // peer addresses so a path can never be read from a different provider.
  return target.protocol === base.protocol && target.host === base.host;
}
