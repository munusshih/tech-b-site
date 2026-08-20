# Technology B class notebook

This Astro site is the notebook companion to the main Technology B class site
at <https://tech-b.designfuture.space>. One repository holds every cohort. The
year shown at `/` is controlled only by `activeYear` in
`src/course-config.json`; it is never advanced by the calendar or a deployment.

The notebook starts blank for Fall 2026.

## URLs and archive behavior

- `/` shows the active cohort (currently Fall 2026).
- `/2026/` redirects to `/` while 2026 is active.
- After a future rollover, `/2026/` becomes a normal read-only archive and the
  new active-year alias redirects to `/`.

Archived pages keep weekly notes, student responses, portfolios, bios, and
uploaded files visible. They are labeled **Archived · Read-only**. Google Form
links and other submission actions are removed, and archived JSON is never
refreshed by the sync commands.

## The files you normally edit

### Course settings, links, and roster

Edit [`src/course-config.json`](src/course-config.json). It keeps the variables
that change from class to class or year to year in one place:

- `activeYear` (change this only through the rollover command below)
- common site, school, instructor, and repository settings
- semester, course code, meeting time, room, and announcement marquee
- main class site, syllabus, and office-hours links
- assignment, project, and bio Google Form links
- assignment and bio Google Sheet IDs and tab names
- weekly schedule section headings, special-project links, and the roster

Keep historical entries in place because archive pages read the configuration
stored under their own year. `repositoryUrl` intentionally starts blank, so
the “Edit this page on GitHub” control stays hidden until a repository URL is
added.

### Weekly Markdown

Weekly notes are namespaced by cohort:

```text
src/content/weeks/
└── 2026/                 # active notes; blank at first
```

The starter lives outside published content at [`templates/week.md`](templates/week.md).
Copy it to `src/content/weeks/2026/week-1.md`, update its frontmatter and
content, and set `draft: false` when it is ready. A filename segment beginning
with `_` or a page with `draft: true` is excluded from navigation, standalone
routes, and RSS. `page: false` lists a week without creating a clickable page.

To use configured forms in raw HTML inside Markdown, use these tokens:

```html
<a class="btn-primary" href="{{assignmentFormUrl}}">Submit Assignment</a>
<a class="btn-primary" href="{{projectFormUrl}}">Submit Project</a>
<a class="btn-primary" href="{{bioFormUrl}}">Submit Bio/Links</a>
```

The active cohort receives the URL from its configuration. The same controls
are automatically disabled when that cohort becomes an archive.

### Student data and media

Fetched data is stored by year:

```text
src/data/2026/student-data.json
src/data/2026/student-bios.json
public/student-files/2026/
```

## Local and deployment workflow

Install once and start Astro:

```bash
npm install
npm run dev
```

Build deterministically without contacting Google or changing JSON/media:

```bash
npm run build:static
```

The normal `npm run build` first syncs the active cohort and then builds. This
preserves the Form → Sheet → Drive pipeline for a future deployment. A year
with blank Sheet settings skips sync cleanly.

The production canonical URL defaults to `https://tech-b.munusshih.com`. Set
the `SITE_URL` environment variable only when building for a different host.

## Sync the active cohort

Fill in the active year's roster and Sheet `id`/`name` values in
`src/course-config.json`, then run:

```bash
npm run sync
```

This fetches assignment and bio responses for `activeYear` only. It cannot
select or overwrite an archive. If either active Sheet ID/tab name pair is
blank, that part prints a clear skip message and exits successfully. New Google
Drive downloads are stored under the active year's media folder.

To sync and then build in one deliberate command:

```bash
npm run build:sync
```

## Advance to the next year manually

The rollover script never runs from `dev`, `build`, a deployment, or the clock.
It accepts only the year immediately after `activeYear`, refuses an existing
target, and requires a clean Git working tree for mutation.

1. Review and commit all current work and student media.
2. Preview the exact rollover; no files change:

   ```bash
   npm run year:advance -- 2027
   ```

3. Apply the same plan explicitly:

   ```bash
   npm run year:advance -- 2027 --confirm
   ```

The confirmed run creates blank year configuration, data files, a weekly
Markdown directory, and a year-scoped media directory. Only after those are in
place does it flip `activeYear`. Then edit the new year's settings, copy
`templates/week.md` into the new year, run `npm run build:static`, review, and
commit.

## Other commands

```bash
npm run fetch:data      # active assignments only
npm run fetch:bios      # active bios only
npm run build:static    # offline/deterministic Astro build
npm run lint
npm run format
npm run preview
```
