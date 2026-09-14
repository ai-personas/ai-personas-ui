# AI Personas UI

An entirely new Preact interface for the Rust design-first runtime. Navigation centers on Work, Personas, Environments, Learning, and Network. There are no invented persona names or portraits.

Run `npm ci`, then `npm run contract` with the sibling runtime built, and `npm run build`. Development uses `npm run dev` and proxies API requests to port 19000. Supply the node token in the connection screen. The installed distribution is served by `personas serve --ui path/to/dist`.

The contract generator reads the runtime's generated JSON schema; it also writes the technical API reference into the matching design repository. Browser tests use public application operations and new temporary data.

`npm run test:browser` verifies fresh public-interface behavior with 10,000 records, 100,000 events, 20 tracked jobs, file upload, lazy text/image viewers and a delayed 64 MB libp2p transfer. It measures 100 navigation/viewer cycles, retained heap, released resources and 390 px layout. Set `PERSONAS_RELEASE=/path/to/installed/release` to test installed assets. Fixtures are mechanism evidence only.

`node tests/live.mjs URL NODE_DIRECTORY OUTPUT_DIRECTORY` records a read-only browser check against an installed live campaign, verifies authored images and responsive navigation, and captures desktop/mobile evidence.
