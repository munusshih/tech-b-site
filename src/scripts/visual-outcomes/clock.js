import * as Tone from "tone";
import { element, svg } from "./common.js";
export function mount(host, { status }) {
  host.replaceChildren();
  host.className = "clock-theatre";
  const stage = element("div", "clock-stage"),
    clock = element("div", "clock-object"),
    face = element("div", "clock-face"),
    time = element("p", "clock-time"),
    label = element("p", "clock-state");
  const eyes = svg("svg", { viewBox: "0 0 180 65", "aria-hidden": "true" });
  eyes.append(
    svg("path", {
      d: "M30 12L65 20M115 20L150 12",
      stroke: "#182f36",
      "stroke-width": 4,
      "stroke-linecap": "round",
    }),
    svg("ellipse", { cx: 50, cy: 39, rx: 7, ry: 11, fill: "#182f36" }),
    svg("ellipse", { cx: 130, cy: 39, rx: 7, ry: 11, fill: "#182f36" }),
  );
  face.append(eyes, time, label);
  clock.append(
    element("div", "clock-bell clock-bell-left"),
    element("div", "clock-bell clock-bell-right"),
    face,
    element("div", "clock-foot clock-foot-left"),
    element("div", "clock-foot clock-foot-right"),
  );
  stage.append(clock);
  const speech = element("div", "clock-speech"),
    kicker = element("p", "clock-caption", "Office of Further Rest");
  host.append(kicker, stage, speech);
  let state, synth, stopAt, timer, protestTimer;
  function silence() {
    synth?.dispose();
    synth = null;
    clearTimeout(protestTimer);
    clock.classList.remove("is-protesting");
  }
  function tick() {
    if (!state) return;
    const left = state.until
      ? Math.max(0, Math.ceil((state.until - Date.now()) / 1000))
      : 0;
    time.textContent = state.awake
      ? "✓"
      : left
        ? `${Math.floor(left / 60)
            .toString()
            .padStart(2, "0")}:${(left % 60).toString().padStart(2, "0")}`
        : "07:00";
    label.textContent = state.awake
      ? "case closed"
      : left
        ? "permission to snooze"
        : "your presence is requested";
    clock.dataset.mood = state.awake ? "awake" : left ? "snoozing" : "ringing";
    if (stopAt && Date.now() >= stopAt) {
      stopAt = null;
      status(
        "Your snooze has expired. The clock is waiting for another explanation.",
      );
    }
  }
  timer = setInterval(tick, 250);
  return {
    update(next) {
      state = next;
      stopAt = state.until && state.until > Date.now() ? state.until : null;
      speech.textContent = state.message;
      tick();
    },
    async enableSound() {
      await Tone.start();
      if (Tone.getContext().state !== "running")
        throw Error(
          "Click Enable sound again to activate sound in this browser.",
        );
    },
    action(receipt, enabled) {
      if (receipt.tool !== "sound_protest") return;
      silence();
      clock.classList.add("is-protesting");
      protestTimer = setTimeout(
        () => clock.classList.remove("is-protesting"),
        1800,
      );
      if (!enabled) return;
      try {
        if (Tone.getContext().state !== "running") {
          status(
            "The clock protested silently. Enable sound again to hear future protests.",
          );
          return;
        }
        synth = new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.05, release: 0.15 },
        }).toDestination();
        synth.volume.value = -18;
        const notes =
          receipt.args.pattern === "polite"
            ? ["C5", "G4", "C5"]
            : ["G4", "G4", "D5", "C5"];
        const start = Tone.now() + 0.03;
        notes.forEach((note, i) =>
          synth.triggerAttackRelease(note, 0.13, start + i * 0.22),
        );
        protestTimer = setTimeout(silence, 1800);
      } catch (e) {
        status(
          `The clock protested, but sound couldn’t play: ${e.message}`,
          true,
        );
      }
    },
    silence,
    destroy() {
      clearInterval(timer);
      silence();
      host.replaceChildren();
    },
  };
}
