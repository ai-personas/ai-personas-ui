import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPeerRouteBase, providerRouteBase, sameRouteOrigin } from '../assets/peer-route.mjs';

test('a signed peer can be addressed without a published web server', () => {
  assert.equal(providerRouteBase({base_url: '', provider_peer_id: '12D3KooWAbC'}), 'libp2p://12D3KooWAbC');
  assert.equal(providerRouteBase({base_url: 'http://127.0.0.1:8765', provider_peer_id: '12D3KooWAbC'}), 'libp2p://12D3KooWAbC');
  assert.equal(providerRouteBase({base_url: 'https://node.example', provider_peer_id: '12D3KooWAbC'}), 'https://node.example');
});

test('opaque URL origins cannot mix records from two peers', () => {
  const first = new URL('libp2p://12D3KooWAbC/telemetry/personas/member.json');
  const second = new URL('libp2p://12D3KooWDef');
  assert.equal(first.origin, second.origin);
  assert.equal(sameRouteOrigin(first, second), false);
  assert.equal(sameRouteOrigin(first, new URL('libp2p://12D3KooWAbC')), true);
});

test('peer addresses reject credentials, query, fragments and path impersonation', () => {
  for (const value of ['libp2p://user@peer', 'libp2p://peer?x=1', 'libp2p://peer#x',
    'libp2p://peer/path', 'libp2p://peer:80', 'javascript:alert(1)', 'http://node.example'])
    assert.equal(normalizedPeerRouteBase(value), '', value);
});
