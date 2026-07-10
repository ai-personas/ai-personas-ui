// Compatibility entrypoint for older bookmarks/caches.
// The maintained portal module lives under assets/; keeping one implementation
// prevents security and discovery behavior from drifting between two copies.
import './assets/discovery.js?v=20260710-provider-authority-v2';
