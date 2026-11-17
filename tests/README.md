# Workshop checks

Run the browser regression suite:

```sh
npm run test:workshops
```

This builds the site, starts a temporary preview on port 4322, and closes it after testing. Chromium is supplied by the Puppeteer development dependency. To test an existing preview, set `WORKSHOP_URL`.

The suite covers:

- All five Markov sources at every n-gram size, custom corpora, unknown prediction contexts, empty and insufficient input, source uploads, and oversized or invalid files.
- Every grammar preset, custom rules, weights, duplicate and invalid names, missing references, cycles, expansion limits, and preserving edits when switching examples.
- Custom chat role edits, saved drafts, sampling controls, multiline and empty messages, cancellation, empty responses, reset, and changing models during a request.
- Eight-turn speaker conversations, per-turn identity, editing during a request, empty custom roles, and saved custom settings.
- Full-illustration coloring, arbitrary RGB values, malformed output, art-direction changes during a request, reset, and protecting a human's paint from a late model response.
- Bird controls, pause/resume/reset, malformed tool calls, recovery, model changes, and the Ollama JSON tool envelope.
- Source previews, real HTML downloads, and running both exported generators, including probabilities, entropy, and varied grammar output. Export execution uses the actual pinned RiTa CDN import and needs internet access.

## Live local-model checks

Keep Llama App running with a local model installed. Start a site preview in another terminal:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4323
```

Run the custom-role and art-direction checks against that preview:

```sh
WORKSHOP_URL=http://127.0.0.1:4323 npm run test:workshops:live
```

To rerun only custom conversation behavior:

```sh
WORKSHOP_URL=http://127.0.0.1:4323 npm run test:workshops:custom
```

Use a production preview for long tests. The development server reloads the page when source or test files change, which interrupts a live conversation or coloring run.

Live model-quality observations cover a Spanish botanist's role and setting across follow-ups and a role-change request; two custom speaker pairs; changing from a Mars greenhouse to an underwater library; explicit opening phrases; dialogue variation; the Spanish pirate/French chef preset; all 52 illustration regions with default colors, red only, an arbitrary exact RGB color, excluded warm colors, and object-specific colors; and real bird tool calls.

Live tests measure the selected model's behavior on these cases. Sampling and model capabilities still affect free-form language and creative quality. Ollama's request and response handling is covered by browser fixtures; the live suite targets Llama App at port 9931.

Functional assertions (completion, valid responses, full-region coverage, and UI behavior) remain strict. Semantic quality checks report observations instead of failing the run by default. This keeps weak instruction following or repetitive dialogue from a small model separate from an application bug. To make those quality checks fail the run, set `WORKSHOP_STRICT_MODEL=1`.

Set `WORKSHOP_MODEL` to an installed model ID to repeat the same checks with a larger model. The application does not apply model-specific opening-phrase parsers, hidden palette restrictions, or dialogue rewriting.
