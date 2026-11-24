import p5 from "p5";
import * as brush from "p5.brush";
import { element } from "./common.js";
const palettes = {
  rose: ["#ad4966", "#d68c91", "#efbdab", "#71639d"],
  fern: ["#396a59", "#80a480", "#b5bc7c", "#aa7658"],
  indigo: ["#464b8a", "#8a87ba", "#b9a5d5", "#b77787"],
};
const hash = (s) =>
  Array.from(s).reduce(
    (h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0,
    2166136261,
  );
export async function mount(host, { status }) {
  host.className = "oracle-cabinet";
  host.replaceChildren();
  const card = element("article", "oracle-card"),
    art = element("div", "oracle-painting"),
    copy = element("div", "oracle-copy");
  card.append(art, copy);
  host.append(card);
  let state, lastSeed, sketch, ready;
  const initialized = new Promise((resolve) => (ready = resolve));
  sketch = new p5((p) => {
    brush.instance(p);
    p.setup = () => {
      p.pixelDensity(1);
      const canvas = p.createCanvas(420, 600, p.WEBGL).elt;
      canvas.setAttribute("role", "img");
      canvas.setAttribute(
        "aria-label",
        "A symbolic painting made with watercolor fills and pencil marks.",
      );
      p.angleMode(p.DEGREES);
      p.noLoop();
      ready();
    };
    p.draw = () => {
      if (!state) return;
      try {
        const r = state.readings.at(-1),
          seed = hash(r ? `${r.entry}/${r.date}` : "an unread card");
        const paintingKey = `${seed}/${r?.motif}/${r?.palette}`;
        if (paintingKey === lastSeed) return;
        lastSeed = paintingKey;
        const colors = palettes[r?.palette || "indigo"],
          motif = r?.motif || "orbit";
        p.randomSeed(seed);
        p.noiseSeed(seed);
        p.clear();
        brush.scaleBrushes(1.6);
        brush.noHatch();
        brush.noStroke();
        brush.fillTexture(0.65, 0.35);
        brush.fillBleed(0.12, "out");
        // A small vocabulary of painted forms, rather than model-written drawing code.
        if (motif === "growth") {
          for (let i = 0; i < 11; i++) {
            const x = -90 + i * 17,
              y = 130 - i * 23;
            brush.fill(colors[i % 4], 85);
            brush.circle(x + (i % 2 ? 45 : -32), y, 38 + p.random(12));
            brush.noFill();
            brush.set("HB", colors[0], 0.8);
            brush.line(-65, 210, x, y);
            brush.noStroke();
          }
          brush.fill(colors[2], 90);
          brush.circle(63, -172, 54);
        } else if (motif === "tides") {
          for (let i = 0; i < 7; i++) {
            brush.fill(colors[i % 4], 65);
            brush.noStroke();
            const points = [
              [-195, 240 - i * 42],
              [-185, 160 - i * 42],
              [-95, 150 - i * 38],
              [-10, 175 - i * 40],
              [95, 110 - i * 35],
              [190, 130 - i * 35],
              [195, 245 - i * 35],
            ];
            brush.polygon(points);
          }
          brush.noFill();
          brush.set("2B", colors[0], 0.65);
          for (let i = 0; i < 11; i++)
            brush.line(-175, 170 - i * 33, 175, 130 - i * 29);
          brush.noStroke();
          brush.fill(colors[2], 85);
          brush.circle(80, -170, 53);
        } else {
          for (let i = 0; i < 6; i++) {
            brush.noStroke();
            brush.fill(colors[i % 4], 65);
            brush.circle(-45 + i * 17, -110 + i * 48, 100 - i * 9);
          }
          brush.noFill();
          brush.set("HB", colors[0], 0.6);
          brush.circle(0, 0, 150);
          brush.circle(0, 0, 158);
          for (let i = 0; i < 12; i++) {
            const a = i * 30;
            brush.line(
              p.cos(a) * 170,
              p.sin(a) * 170,
              p.cos(a) * 181,
              p.sin(a) * 181,
            );
          }
        }
        brush.noFill();
        brush.set("HB", colors[0], 0.5);
        for (let i = 0; i < 28; i++) {
          const x = p.random(-163, 163),
            y = p.random(-245, 245);
          brush.line(x, y, x + 1.8, y + 0.6);
        }
      } catch (error) {
        status(
          `The reading is available, but the painting couldn’t render: ${error.message}`,
          true,
        );
      }
    };
  }, art);
  await initialized;
  function update(next) {
    state = next;
    copy.replaceChildren();
    const r = state.readings.at(-1);
    card.dataset.motif = r?.motif || "orbit";
    copy.append(
      element(
        "p",
        "oracle-kicker",
        r ? `A reading for ${r.date}` : "A small appointment with yourself",
      ),
    );
    copy.append(
      element("h3", "oracle-title", r?.title || "Something to sit with."),
    );
    if (r) {
      const reading = element("div", "oracle-reading");
      r.reading
        .split(/\n+/)
        .filter(Boolean)
        .forEach((p) => reading.append(element("p", "", p)));
      copy.append(reading);
      const ritual = element("div", "oracle-ritual");
      ritual.append(
        element("span", "", "A small ritual"),
        element("p", "", r.ritual),
      );
      copy.append(ritual);
    } else
      copy.append(
        element(
          "p",
          "oracle-empty",
          "The card is unturned. Your first entry will give the oracle something to recognize.",
        ),
      );
    copy.append(
      element(
        "p",
        "oracle-fiction",
        "A reflective fiction, written from what you share.",
      ),
    );
    pRedraw();
  }
  function pRedraw() {
    sketch.redraw();
  }
  return {
    update,
    destroy() {
      sketch.remove();
      host.replaceChildren();
    },
  };
}
