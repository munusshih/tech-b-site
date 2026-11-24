import { outcomes } from "./catalog.js";
import {
  generators,
  check,
  noticeSchema,
  oracleSchema,
  validateExhibition,
  clockMemory,
  restoreClockState,
  newClockMorning,
  clockGotUp,
} from "./scores.js";
import { withPlaygroundConnection } from "../app.js";
const controllers = [];
const keyFor = (id) =>
  `tech-b-provotypes-${id === "archive" ? "v2" : "v1"}-${id}`;
export function validateSaved(id, value) {
  if (!value || typeof value !== "object") throw Error("Invalid session.");
  if (id === "notice") {
    if (!Array.isArray(value.notices) || value.notices.length > 8)
      throw Error("Invalid notices.");
    value.notices.forEach((n) =>
      check(
        {
          subject: n.subject,
          headline: n.headline,
          body: n.body,
          closing: n.closing,
        },
        noticeSchema,
      ),
    );
  }
  if (id === "oracle") {
    if (
      typeof value.memory !== "string" ||
      value.memory.length > 280 ||
      !Array.isArray(value.readings) ||
      value.readings.length > 8
    )
      throw Error("Invalid cards.");
    value.readings.forEach((r) =>
      check(
        Object.fromEntries(
          Object.keys(oracleSchema.properties).map((k) => [k, r[k]]),
        ),
        oracleSchema,
      ),
    );
  }
  if (id === "archive") {
    if (
      !Array.isArray(value.objects) ||
      value.objects.length > 12 ||
      !Array.isArray(value.exhibitions) ||
      value.exhibitions.length > 4 ||
      !Array.isArray(value.excluded)
    )
      throw Error("Invalid collection.");
    for (const o of [
      ...value.objects,
      ...value.exhibitions.flatMap((e) => e.sources || []),
    ])
      if (
        new URL(o.image).hostname !== "images.metmuseum.org" ||
        !["www.metmuseum.org", "metmuseum.org"].includes(
          new URL(o.url).hostname,
        )
      )
        throw Error("Invalid source.");
    for (const e of value.exhibitions)
      validateExhibition(
        {
          title: e.title,
          introduction: e.introduction,
          objects: e.objects.map(({ id, caption, anchor }) => ({
            id,
            caption,
            anchor,
          })),
        },
        e.sources,
      );
  }
  if (id === "clock") return restoreClockState(value);
  return value;
}
function setup(root) {
  const outcome = outcomes.find((o) => o.id === root.dataset.outcome),
    id = outcome.id;
  const get = (name) => root.querySelector(`[data-visual-${name}]`);
  let state = structuredClone(outcome.starter),
    renderer,
    loading,
    abort,
    pending = false,
    soundEnabled = false;
  // For the clock, validation restores only the case record, never time or sound.
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(id)));
    if (saved) state = validateSaved(id, saved);
  } catch {
    // Start fresh when a stored session is incomplete or from an old schema.
  }
  function status(message, error = false) {
    get("status").textContent = message;
    get("status").dataset.error = String(error);
  }
  function trace(name, value) {
    const d = document.createElement("details"),
      s = document.createElement("summary"),
      p = document.createElement("pre");
    s.textContent = name;
    p.textContent =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    d.append(s, p);
    get("trace").append(d);
  }
  function save() {
    try {
      localStorage.setItem(keyFor(id), JSON.stringify(state));
    } catch {
      status(
        "This browser couldn’t save the session. You can download a JSON copy below.",
      );
    }
  }
  function extras() {
    if (id === "oracle")
      root.querySelector("[data-oracle-memory]").value = state.memory;
    if (id === "notice")
      root.querySelector("[data-art-download]").hidden = !state.notices.length;
    if (id === "archive") {
      const selection = root.querySelector("[data-art-selection]");
      selection.replaceChildren();
      state.objects.forEach((o) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "collection-object";
        b.disabled = pending;
        b.setAttribute("aria-pressed", String(!state.excluded.includes(o.id)));
        b.setAttribute(
          "aria-label",
          `${o.title}. ${state.excluded.includes(o.id) ? "Excluded; click to include." : "Included; click to exclude."}`,
        );
        const img = document.createElement("img");
        img.src = o.image;
        img.alt = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        const title = document.createElement("span");
        title.textContent = o.title;
        b.append(img, title);
        b.addEventListener("click", () => {
          if (pending) return;
          state.excluded = state.excluded.includes(o.id)
            ? state.excluded.filter((x) => x !== o.id)
            : [...state.excluded, o.id];
          save();
          extras();
        });
        selection.append(b);
      });
    }
    if (id === "clock") {
      get("run").disabled = pending || state.awake;
      root.querySelector("[data-clock-up]").disabled = state.awake;
      const memory = clockMemory(state);
      root.querySelector("[data-clock-memory-summary]").textContent =
        memory.appeals
          ? `The clock has heard ${memory.appeals} ${memory.appeals === 1 ? "appeal" : "appeals"} and conceded ${memory.grantedMinutes} ${memory.grantedMinutes === 1 ? "minute" : "minutes"}. New mornings keep this record.`
          : "Nothing on file yet. Your next appeal starts the record.";
      root.querySelector("[data-clock-forget]").disabled = pending;
      const entries = root.querySelector("[data-clock-memory]");
      entries.replaceChildren();
      for (const entry of [...memory.entries.slice(-6)].reverse()) {
        const item = document.createElement("li");
        const heading = document.createElement("p");
        heading.className = "clock-memory-meta";
        heading.textContent = `Morning ${entry.morning}`;
        item.append(heading);
        if (entry.kind === "got_up") {
          const p = document.createElement("p");
          p.textContent = "You said you were up.";
          item.append(p);
        } else {
          const quote = document.createElement("blockquote");
          quote.textContent = entry.excuse;
          const p = document.createElement("p");
          p.textContent = entry.reply;
          item.append(quote, p);
        }
        entries.append(item);
      }
      const receipts = root.querySelector("[data-clock-receipts]");
      receipts.replaceChildren();
      for (const r of state.receipts) {
        const p = document.createElement("p");
        p.textContent = `${r.tool}(${JSON.stringify(r.args)})${r.until ? " / expires " + new Date(r.until).toLocaleTimeString() : ""}${r.tool === "sound_protest" ? " / " + (r.soundEnabled ? "sound requested" : "muted") : ""}`;
        receipts.append(p);
      }
    }
    const history = get("history");
    history.replaceChildren();
    const records =
      state.notices || state.readings || state.exhibitions || state.turns;
    if (!records.length)
      history.textContent = "Your completed sessions will appear here.";
    for (const record of [...records].reverse()) {
      const d = document.createElement("details"),
        s = document.createElement("summary"),
        p = document.createElement("pre");
      s.textContent =
        record.headline || record.title || record.role || "Session";
      p.textContent = JSON.stringify(record, null, 2);
      d.append(s, p);
      history.append(d);
    }
  }
  function commit(next) {
    state = structuredClone(next);
    save();
    renderer?.update(state);
    extras();
  }
  async function ensure() {
    return (loading ||= (async () => {
      const module = await import(`./renderers/${id}.js`);
      renderer = await module.mount(get("art"), { status });
      renderer.update(state);
    })().catch((e) => {
      loading = null;
      throw e;
    }));
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting)
        ensure().catch((e) =>
          status(`Couldn’t open this project: ${e.message}`, true),
        );
    },
    { rootMargin: "200px" },
  );
  observer.observe(get("art"));
  get("stop").addEventListener("click", () => abort?.abort());
  async function run(e) {
    e.preventDefault();
    if (pending) return;
    const prompt = get("prompt").value.trim();
    if (!prompt && id !== "archive") {
      status("Write something in the box first.", true);
      return;
    }
    if (id === "oracle") {
      state.memory = root.querySelector("[data-oracle-memory]").value.trim();
      save();
    }
    get("form")
      .querySelectorAll("textarea,select,[data-forget-memory]")
      .forEach((el) => (el.disabled = true));
    pending = true;
    abort = new AbortController();
    root.classList.add("is-running");
    get("stop").hidden = false;
    extras();
    try {
      await withPlaygroundConnection(async (connection) => {
        await ensure();
        let count = 0;
        const ctx = {
          ...connection,
          state: structuredClone(state),
          prompt,
          level: root.querySelector("[data-notice-level]")?.value,
          memory: state.memory,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          now: () => Date.now(),
          get soundEnabled() {
            return soundEnabled;
          },
          trace,
          commit(value) {
            if (abort.signal.aborted)
              throw new DOMException("Stopped", "AbortError");
            commit(value);
          },
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(360000)]),
          requested() {
            status(`Working with your local model / request ${++count}…`);
          },
          action(receipt) {
            renderer.action?.(receipt, soundEnabled);
          },
        };
        commit(await generators[id](ctx));
        status(
          {
            notice:
              "Filed. Your original grievance and earlier versions are in the session record.",
            oracle:
              "Your card is ready. You can inspect or edit the note the oracle kept.",
            archive:
              "The exhibition is ready. Open its editorial record to follow the argument through the three roles.",
            clock:
              "The clock has responded. You can answer it, or get up on your own terms.",
          }[id],
        );
      });
    } catch (e) {
      status(
        ["AbortError", "TimeoutError"].includes(e.name)
          ? "Stopped. Any completed action has been kept."
          : e.message,
        true,
      );
      trace("Request stopped", e.message);
    } finally {
      get("form")
        .querySelectorAll("textarea,select,[data-forget-memory]")
        .forEach((el) => (el.disabled = false));
      pending = false;
      abort = null;
      root.classList.remove("is-running");
      get("stop").hidden = true;
      extras();
    }
  }
  get("form").addEventListener("submit", run);
  if (id === "oracle") {
    const memory = root.querySelector("[data-oracle-memory]");
    memory.addEventListener("input", () => {
      state.memory = memory.value;
      save();
    });
    root.querySelector("[data-forget-memory]").addEventListener("click", () => {
      state.memory = "";
      memory.value = "";
      save();
      status(
        "Memory forgotten. Your next reading will only use what you write then.",
      );
    });
  }
  if (id === "archive") {
    fetch(new URL("./collection.json", import.meta.url), { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw Error("Collection unavailable.");
        return r.json();
      })
      .then((records) => {
        if (
          !pending &&
          state.objects.map((o) => o.id).join() !==
            records.map((o) => o.id).join()
        )
          commit({
            ...state,
            topic: outcome.starter.topic,
            objects: records,
            excluded: state.excluded.filter((id) =>
              records.some((o) => o.id === id),
            ),
          });
      })
      .catch(() =>
        status("The collection couldn’t load. Reload the page to try again."),
      );
  }
  if (id === "clock") {
    root.querySelector("[data-clock-up]").addEventListener("click", () => {
      abort?.abort();
      renderer?.silence();
      commit(clockGotUp(state));
      status("The negotiation is over.");
    });
    root.querySelector("[data-clock-new]").addEventListener("click", () => {
      if (pending) return;
      renderer?.silence();
      commit(newClockMorning(state));
      status("Another morning. Your earlier appeals are still on file.");
    });
    root.querySelector("[data-clock-forget]").addEventListener("click", () => {
      if (pending) return;
      commit({
        ...state,
        memory: structuredClone(outcome.starter.memory),
        turns: [],
        receipts: [],
        message: "The file is empty. Make your case.",
      });
      status("The clock’s record has been erased from this browser.");
    });
    root
      .querySelector("[data-clock-sound]")
      .addEventListener("click", async (e) => {
        const button = e.currentTarget;
        try {
          await ensure();
          if (!soundEnabled) await renderer.enableSound();
          else renderer.silence();
          soundEnabled = !soundEnabled;
          button.setAttribute("aria-pressed", String(soundEnabled));
          button.textContent = soundEnabled ? "Mute sound" : "Enable sound";
          root.querySelector("[data-clock-quiet]").hidden = !soundEnabled;
          status(
            soundEnabled
              ? "Sound enabled. Only an actual protest tool call will play it."
              : "Sound muted.",
          );
        } catch (error) {
          status(error.message, true);
        }
      });
    root
      .querySelector("[data-clock-quiet]")
      .addEventListener("click", () => renderer?.silence());
  }
  root
    .querySelector("[data-art-download]")
    ?.addEventListener("click", async () => {
      await ensure();
      renderer.download?.();
    });
  get("reset").addEventListener("click", () => {
    if (pending) return;
    renderer?.silence?.();
    const next = structuredClone(outcome.starter);
    if (id === "archive")
      Object.assign(next, {
        objects: state.objects,
        topic: state.topic,
        excluded: state.excluded,
      });
    commit(next);
    get("trace").replaceChildren();
    status("This project has been cleared.");
  });
  get("save").addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-session.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (get("code")) get("code").textContent = generators[id].toString();
  const codeDetails = get("renderer-code")?.closest("details");
  codeDetails?.addEventListener("toggle", async () => {
    if (!codeDetails.open || get("renderer-code").textContent) return;
    try {
      const r = await fetch(new URL(`./sources/${id}.js`, import.meta.url));
      if (!r.ok) throw Error("Source unavailable.");
      get("renderer-code").textContent = await r.text();
    } catch (e) {
      get("renderer-code").textContent = e.message;
    }
  });
  if (!location.pathname.startsWith("/week-13/llm-playground/")) {
    const link = root.querySelector("[data-visual-download]");
    link.textContent = "Editable source: visual-outcomes folder";
    link.removeAttribute("href");
    link.removeAttribute("download");
  }
  root.dataset.ready = "true";
  get("run").disabled = false;
  extras();
  controllers.push(() => {
    observer.disconnect();
    abort?.abort();
    renderer?.destroy();
  });
}
for (const root of document.querySelectorAll("[data-outcome]")) setup(root);
window.addEventListener(
  "pagehide",
  () => controllers.forEach((stop) => stop()),
  { once: true },
);
