# Design QA

## Current 2026 direction

- Typography: Source Serif 4 is used throughout. Titles and section headings use the compact 1.15rem scale established by the Technology A notebook.
- Notebook details: the wavy `h1` underline, `h2` arrow marker, year underline, and external-link arrow are active again.
- Background: the purple wash and dot field now continue across every 2026 route. The continuous MET collection collage remains the homepage-only primary visual, with object-detection annotations and autonomous cursor activity rendered behind the page content.
- Motion accessibility: reduced-motion preferences are respected, and the background remains decorative and pointer-free so it does not interfere with course navigation.
- Readability: the neutral paper, dark-teal ink, muted-red accent, and teal-gray echo palette remains restored, with the wavy underline and arrow using the muted-red accent.
- Layout: the desktop grid row is explicitly at least `100vh`/`100dvh`, so every column reaches the full viewport height and can expand with content.
- Week 1 layout: the lecture, workshop, examples, assignment, readings, and tutorials share one page. The Class Notebook response area sits below the weekly navigation in the sidebar, while the long-form lecture surface spans the remaining two desktop columns.
- Week 1 navigation: an `On This Page` outline mirrors the lecture and weekly headings, with working anchored links for each section.
- Lecture typography: the main content has a clear `h2`/`h3`/`h4` hierarchy, readable line lengths, and unboxed lecture content. Code and iframe examples use square, transparent frames with compact monospace toolbars.
- Route coverage: the 2026 homepage retains the MET collage, while week and tutorial routes keep content-first layouts over the shared purple/dot field. Former Week 1 lecture URLs redirect to the combined Week 1 page.

## Verification

- `npm run build:static`: passed. Expected warnings remain for the empty `tutorials` collection.
- `npm run lint -- --quiet`: passed.
- `git diff --check`: passed.
- The MET background implementation remains intact.
- In-browser QA passed on `/`, `/week-1/`, and `/tutorials/`: the course title has identical text and computed typography on all three routes, and the shared purple/dot layers are present throughout.
- In-browser Week 1 QA confirmed a full-height sidebar beside a two-column main surface, monospace JavaScript blocks with language labels and working copy controls, and working iframe refresh/open-original controls.
- A 390px mobile pass confirmed the layout collapses to one column without horizontal page overflow; long code remains horizontally scrollable inside its own frame.
- The embedded p5 editor still emits its own sensor permission warnings; no local asset or route errors remain.

The former background studies remain historical artifacts only and no longer represent the current implementation.
