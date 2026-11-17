# Conditional prompts for small local models

Tested November 17, 2026 using Llama App 0.47.0, an 8,192-token context, and optional reasoning disabled.

## Changes

Models identified below 8B through the existing parameter-count profile now use compact prompts in the speaker and coloring exercises. Larger and unknown models retain their existing prompts. No model-family name controls the condition.

- Speaker requests carry the shared setting, active role instructions, and the latest line from each speaker. The instructions emphasize a single short turn and exact required opening text. This reduces imitation of older dialogue and keeps the active role close to generation.
- Coloring requests carry the art direction and current object together. The full paint history is omitted from the small-model prompt because it encouraged reuse of unrelated colors as an accidental palette.
- Token limits, sampling settings, output validation, and the 62 model-quality checks remain unchanged. The short-context path omits older dialogue and paint context; the application inspector still shows the full observed state.

## Full workshop results

The production build and all 15 browser regression tests passed. The browser fixtures now exercise the small-model path, while the reasoning-model fixture exercises the larger-model path. Both real models completed all chat, speaker, coloring, and tool flows, making 298 completion requests each. Both filled all five 52-region illustrations and cleared at least one pipe.

| Model               | Previous quality checks | Follow-up quality checks | Functional flows |
| ------------------- | ----------------------- | ------------------------ | ---------------- |
| Qwen2.5 1.5B Q4_K_M | 48/62                   | 59/62                    | Pass             |
| GPT-OSS 20B MXFP4   | 62/62                   | 62/62                    | Pass             |

Qwen improved from 35/42 to 40/42 dialogue checks and from 13/20 to 19/20 coloring and tool checks. Its truncated replies fell from five to zero. The three remaining quality misses were two dialogue-variety checks and one mountain color assignment. GPT-OSS retained 62/62 with the original large-model prompts. Neither model returned HTTP errors or reasoning content, and neither had truncated replies in the follow-up run.

The full runs use normal sampling, so these scores are observations rather than guaranteed outcomes for every prompt. The same quality checks were used before and after. Detailed observations, timings, and budgets are in [the JSON results](./small-model-prompts-2026-11-17.json). The earlier results remain in [the baseline report](./local-models-2026-11-17.md).

## Targeted A/B probe

Before enabling the compact path, Qwen was also tested with both prompt variants using requested seeds 42 and 123. The probe included existing object-color directions and an additional direction assigning different hex colors to craters, clouds, and sky.

| Check                                     | Full prompt | Compact prompt |
| ----------------------------------------- | ----------- | -------------- |
| Correct object-specific colors            | 12/16       | 15/16          |
| Exact speaker prefixes                    | 1/16        | 16/16          |
| Unique lines in the two eight-turn scenes | 3, 5        | 6, 7           |

One compact-probe speaker reply reached its output limit; neither follow-up full workshop run produced truncated replies.

## Repeat the full checks

Use the commands in [the baseline report](./local-models-2026-11-17.md#repeat-the-checks). The application chooses the prompt profile automatically from model size. Quality checks are reported separately from functional assertions; `WORKSHOP_STRICT_MODEL=1` makes quality misses fail the test process too.
