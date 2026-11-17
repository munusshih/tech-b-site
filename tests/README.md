# Workshop checks

Run the production build and browser regression checks:

```sh
npm run test:workshops
```

The connection checks cover editable localhost addresses, non-default ports, common-port discovery, per-app address persistence, and canceling stale replies after an address changes. They also execute the copyable starters with both runtime choices on an alternate port.

To exercise an installed model through Llama App, start the site and run:

```sh
npm run dev -- --host 127.0.0.1
WORKSHOP_MODEL='your-installed-model-id' npm run test:workshops:live
```

If the API uses a different port, set its server address:

```sh
WORKSHOP_ENDPOINT='http://localhost:8080' WORKSHOP_MODEL='your-installed-model-id' npm run test:workshops:live
```

`WORKSHOP_URL` selects the site preview address; `WORKSHOP_ENDPOINT` selects the model server address. The server address may also end in `/v1`. The live scripts set the connection field before finding models, so discovery and completions use the same chosen address.

In the workshop, **Try common ports** checks the entered address, then the selected app's common addresses: ports 9931 and 8080 for Llama App, or 11434 for Ollama, using both `127.0.0.1` and `localhost`. It does not scan every port. Enter other ports manually using the address from the app's server settings. Successful addresses are remembered separately for each app in that browser.
