import { outcomes } from "./catalog.js";
export const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const inline = (s) =>
  escape(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
export const outcomesIntroHTML = `<h2 id="visual-outcomes">What could you make with this?</h2><div class="workshop-explanation"><p>After trying these examples, you can start thinking about what you’d like a model’s response to become. It might be a document with an absurd amount of authority, an oracle that seems to know you, an exhibition that makes a case, or an everyday object you have to negotiate with. These four small provotypes use different inputs and different ways of responding. Try them as pieces in their own right, then follow the code to see which decisions belong to the model and which ones we’ve built into the program.</p></div>`;
function noteStep(text) {
  const value = inline(text),
    match = value.match(/^<strong>([\s\S]*?)<\/strong>\s*([\s\S]*)$/);
  return `<li><div class="workshop-step-content">${match ? `<p class="workshop-step-title">${match[1]}</p><div class="workshop-step-copy">${match[2]}</div>` : `<div class="workshop-step-copy">${value}</div>`}</div></li>`;
}
const action = (o) =>
  `<div class="outcome-action-line"><button type="submit" class="workshop-button workshop-button--primary" data-visual-run disabled>${escape(o.action)}</button><button type="button" class="outcome-text-button" data-visual-stop hidden>Stop request</button></div>`;
function inputs(o) {
  if (o.id === "notice")
    return `<label class="workshop-field">What you actually want to say<textarea data-visual-prompt rows="3" maxlength="1600" required>${escape(o.prompt)}</textarea></label><label class="outcome-select">How professional? <select data-notice-level><option value="professional">Professionally polite</option><option value="unnecessary" selected>Professionally unnecessary</option><option value="committee">A committee has been formed</option></select></label>`;
  if (o.id === "oracle")
    return `<label class="workshop-field">What’s on your mind today?<textarea data-visual-prompt rows="3" maxlength="1600" required>${escape(o.prompt)}</textarea></label><details class="oracle-memory"><summary>What the oracle remembers</summary><label class="workshop-field">You can change this before the next reading<textarea data-oracle-memory rows="3" maxlength="280" placeholder="Nothing yet. The first reading will leave a note here."></textarea></label><button type="button" class="outcome-text-button" data-forget-memory>Forget memory</button><p class="outcome-hint">This note and your cards are stored in this browser. Only this note is used as context for your next reading.</p></details>`;
  if (o.id === "archive")
    return `<p class="outcome-hint">Start with these twelve objects from the Met collection. Click an object to leave it out, keeping at least three. Give the curator a question, or let the team find a connection.</p><div data-art-selection class="collection-selection"></div><label class="workshop-field">A question for the curator <span class="field-optional">(optional)</span><textarea data-visual-prompt rows="2" maxlength="800" placeholder="What kinds of company do these objects offer?"></textarea></label>`;
  return `<label class="workshop-field">Your case for staying in bed<textarea data-visual-prompt rows="2" maxlength="1000" required>${escape(o.prompt)}</textarea></label>`;
}
const controls = (o) =>
  o.id === "notice"
    ? '<button type="button" data-art-download class="outcome-text-button" hidden>Download this announcement</button>'
    : o.id === "clock"
      ? '<div class="clock-controls"><button type="button" class="workshop-button workshop-button--secondary" data-clock-up>I’m up</button><button type="button" class="outcome-text-button" data-clock-new>New morning</button><button type="button" class="outcome-text-button" data-clock-sound aria-pressed="false">Enable sound</button><button type="button" class="outcome-text-button" data-clock-quiet hidden>Stop sound</button></div><details class="clock-memory"><summary>What the clock remembers</summary><p data-clock-memory-summary></p><ol data-clock-memory></ol><button type="button" class="outcome-text-button" data-clock-forget>Forget the record</button><p class="outcome-hint">The record stays in this browser, including across new mornings. The clock receives it again with your next appeal.</p></details><p class="outcome-hint">A browser toy, not a system alarm. Sound is optional, and you can get up without convincing it.</p>'
      : "";
export const outcomeHTML = (
  o,
  { heading = true, notes = true, intro = true, source = true } = {},
) => `
${heading ? `<h2 id="outcome-${o.id}" class="workshop-section-heading"><span class="workshop-section-number">${o.letter}</span><span>${escape(o.title)}</span></h2>` : ""}
<section class="visual-outcome outcome-${o.id}" data-outcome="${o.id}" aria-label="${escape(o.title)}">
${intro ? `<p>${escape(o.intro)}</p>` : ""}
${notes ? `<aside class="download-munus-note"><strong>How does it work?</strong><ol class="workshop-concept-steps workshop-reading-steps">${o.steps.map(noteStep).join("")}</ol></aside>` : ""}
<div class="outcome-experiment"><form data-visual-form>${inputs(o)}${action(o)}</form><div data-visual-art class="outcome-art"></div>${controls(o)}<p data-visual-status class="outcome-status" role="status" aria-live="polite"></p></div>
<details class="outcome-details" data-visual-details><summary>Requests, records, and downloads</summary>
<p class="visual-library">${escape(o.library)} / ${o.concepts.map(([id, name]) => `<a href="#${id}">${escape(name)}</a>`).join(" + ")}</p>
${o.id === "archive" ? '<p class="outcome-hint">Public-domain collection images and records from <a href="https://metmuseum.github.io/">The Metropolitan Museum of Art</a>. The exhibition text is a model-written interpretation of those records.</p>' : ""}
${o.id === "clock" ? "<details><summary>Actions the clock actually took</summary><div data-clock-receipts></div></details>" : ""}
<details><summary>${o.id === "archive" ? "Earlier exhibitions and editorial records" : "Session record"}</summary><div data-visual-history></div></details>
<details><summary>Requests and responses</summary><div data-visual-trace></div></details>
${source ? `<details><summary>Model interaction / scores.js</summary><pre data-visual-code tabindex="0"></pre></details><details><summary>Output / ${o.id}.js</summary><pre data-visual-renderer-code tabindex="0"></pre></details>` : ""}
<div class="outcome-file-actions"><a href="/llm-playground/downloads/visual-${o.id}.zip" data-visual-download download>Download project ${o.letter}</a><button type="button" data-visual-save>Save session (.json)</button><button type="button" data-visual-reset>${{ notice: "Clear announcements", oracle: "Clear cards and memory", archive: "Clear exhibitions", clock: "Clear clock and record" }[o.id]}</button></div>
</details></section>`;
export const outcomesHTML =
  outcomesIntroHTML + outcomes.map((o) => outcomeHTML(o)).join("");
