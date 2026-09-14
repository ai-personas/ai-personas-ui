# AI Personas UI

An entirely new Preact interface for the Rust design-first runtime. Navigation centers on Work, Personas, Environments, Learning, and Network. There are no invented persona names or portraits.

Run `npm ci`, then `npm run contract` with the sibling runtime built, and `npm run build`. Development uses `npm run dev` and proxies API requests to port 19000. Supply the node token in the connection screen. The installed distribution is served by `personas serve --ui path/to/dist`.

The contract generator reads the runtime's generated JSON schema; it also writes the technical API reference into the matching design repository. Browser tests use public application operations and new temporary data.

`npm run test:network -- /path/to/installed/release` opens the installed UI against two fresh nodes and sends actual libp2p traffic through delayed TCP proxies. It verifies visible transfer progress, responsive navigation, cancellation and removal of partial files. The test publishes new random bytes and invokes no model provider.
