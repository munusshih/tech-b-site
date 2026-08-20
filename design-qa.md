# Design QA

- Source truth: three approved low-fidelity AI/ML visual references:
  - `/Users/munusshih/.codex/generated_images/01a01fc4-d798-72c3-9871-ccdb1cd7426c/exec-05abf7e8-be28-4a0f-b325-f25037f92d66.png`
  - `/Users/munusshih/.codex/generated_images/01a01fc4-d798-72c3-9871-ccdb1cd7426c/exec-e81218c2-bc9a-4524-a6c6-b5c24c60e7f0.png`
  - `/Users/munusshih/.codex/generated_images/01a01fc4-d798-72c3-9871-ccdb1cd7426c/exec-2730abeb-7573-4c50-ac0e-c1d86ee08235.png`
- Implementation captures: `tech-b-mode-1-implementation.png`, `tech-b-mode-2-implementation.png`, and `tech-b-mode-3-implementation.png` in `/Users/munusshih/.codex/visualizations/2026/08/20/01a01fc4-d798-72c3-9871-ccdb1cd7426c/design-qa/`.
- Full-view comparisons: matching `tech-b-mode-1-comparison.png`, `tech-b-mode-2-comparison.png`, and `tech-b-mode-3-comparison.png` files in that directory.
- Focused comparison: `tech-b-mode-2-focused-comparison.png` verifies the title column and schedule boundary after adding a reading quiet zone.
- Viewport/state: every source was normalized to 1200 x 800 CSS pixels and compared to the corresponding desktop root-route state.
- Fidelity surfaces: Instrument Serif headings, Source Serif body text, ruled three-column notebook grid, paper texture, restrained computational marks, readable left column, and a lightweight underlined mode selector.
- Intentional differences: reference images are static art direction; the shipped visuals are live, responsive p5 sketches. Course information and the existing year system remain functional content rather than becoming part of the illustration.
- Interaction/resilience: all three radio states switch; Arrow keys switch modes; the selected mode persists across reload; 390 x 844 has no horizontal overflow; local console contains no warnings or errors.
- Accessibility: the control uses a named radiogroup, programmatic checked state, visible keyboard focus, and descriptive screen-reader labels.
- History: fixed an overly broad selector that matched the root element; added a left-column quiet zone to mode 2 after comparison showed excessive density behind course information.
- Findings: no open P0, P1, or P2 issues.

final result: passed
