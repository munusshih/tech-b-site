# Local workshop model comparison

Tested November 17, 2026 using Llama App 0.47.0 on a Mac with 24 GiB unified memory. Both models used an 8,192-token context. Optional reasoning was disabled with `thinking_budget_tokens: 0`.

## Results

The production build and all 15 browser regression tests passed. Both real models completed custom chat, three eight-turn speaker scenarios, five full illustrations, and bird tool calls. Each model made 298 completion requests, including 260 coloring decisions. Both cleared at least one pipe. Neither returned HTTP errors or reasoning content.

| Model               | Functional flows | Quality checks | Median dialogue | Median color choice | Median tool call |
| ------------------- | ---------------- | -------------- | --------------- | ------------------- | ---------------- |
| GPT-OSS 20B MXFP4   | Pass             | 62/62          | 2075 ms         | 554 ms              | 537 ms           |
| Qwen2.5 1.5B Q4_K_M | Pass             | 48/62          | 610 ms          | 264 ms              | 201 ms           |

Quality checks measure model-dependent instruction following and creativity. They are separate from hard functional assertions. Qwen missed exact speaker prefixes, repeated dialogue, and misapplied some object-specific colors. Five Qwen speaker replies reached their output limit. GPT-OSS had no truncated replies and passed every quality check. The application preserves the model's actual output rather than substituting answers to satisfy these checks.

An earlier GPT-OSS run with reasoning enabled also passed all 42 dialogue quality checks, but its median dialogue latency was 5,926 ms, compared with 2,075 ms with reasoning disabled. The original 80-token coloring limit could produce an empty final answer because reasoning consumed the entire budget. Browser protocol timeouts also needed increasing for the slower run.

These are observed workshop timings, including local load and cache effects, rather than a controlled throughput benchmark. Full scores, observations, budgets, and timings are in [the JSON results](./local-models-2026-11-17.json).

## Compatibility changes

Generation settings use reported parameter counts, with numeric model-size labels as a fallback. Models below 8B get compact defaults; larger and unknown models get roomier defaults. No model-family names control these settings. Llama App requests disable optional reasoning; Ollama requests retain their existing API fields.

| Exercise               | Below 8B | Larger or unknown |
| ---------------------- | -------- | ----------------- |
| Default chat allowance | 192      | 512               |
| Speaker turn           | 256      | 512               |
| Color choice           | 80       | 256               |
| Tool call              | 128      | 256               |

Students can adjust the chat allowance up to 2,048 tokens. The copyable starters use the same sizing approach. Requests allow 120 seconds for cold starts and slower hardware, while live tests allow longer complete runs and verify that the requested model was actually selected. Existing JSON and tool-call validation remains active.

The local context overrides are saved in `~/.config/llama/models.user.ini`; they are machine settings, not repository changes. Other machines should choose a context that fits their model and available memory.

## Repeat the checks

Start a local preview, then run both models sequentially:

```sh
npm run test:workshops
npm run preview -- --host 127.0.0.1 --port 4323
```

In another terminal:

```sh
WORKSHOP_URL=http://127.0.0.1:4323 WORKSHOP_MODEL='ggml-org/gpt-oss-20b-GGUF:MXFP4' npm run test:workshops:live
WORKSHOP_URL=http://127.0.0.1:4323 WORKSHOP_MODEL='Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M' npm run test:workshops:live
```

Substitute any installed text model ID from the local API catalog. Add `WORKSHOP_STRICT_MODEL=1` to make quality observations fail the process as well as functional failures.
