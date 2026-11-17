/* global AbortController, AbortSignal, Path2D, clearTimeout, document, setTimeout */
import { colorRequest } from "./llama-instructions.js";

const hexColor = /^#[0-9a-f]{6}$/i;
const outline = "#2b2144";

// Path order is also paint order. Reverse it for hit testing overlapping regions.
const poster = [
  ["sky-upper", "Upper sky", "M28 25H692Q704 25 704 37V167H16V37Q16 25 28 25Z"],
  ["sky-middle", "Middle sky", "M16 167H704V303H16Z"],
  [
    "sky-lower",
    "Lower sky",
    "M16 303H704V443Q704 455 692 455H28Q16 455 16 443Z",
  ],
  ["sun", "Sun", "M134 196A34 34 0 1 1 66 196A34 34 0 1 1 134 196Z"],
  [
    "sun-center",
    "Sun center",
    "M116 196A16 16 0 1 1 84 196A16 16 0 1 1 116 196Z",
  ],
  [
    "star-upper-left",
    "Small star",
    "M470 48L477 65L494 70L478 77L472 94L465 78L448 74L464 66Z",
  ],
  [
    "star-upper-right",
    "Small star",
    "M655 145L661 159L676 164L662 170L657 185L651 171L636 167L650 160Z",
  ],
  [
    "star-middle",
    "Small star",
    "M438 200L443 211L455 215L444 220L439 232L434 221L422 217L433 212Z",
  ],
  [
    "cloud-left",
    "Left cloud",
    "M50 117Q50 103 68 103Q68 85 90 83Q109 79 118 98Q140 93 149 108Q156 127 133 127H68Q50 127 50 117Z",
  ],
  [
    "cloud-top",
    "Upper cloud",
    "M170 68Q172 55 192 56Q196 38 219 38Q237 38 245 53Q269 54 269 68Q269 79 252 79H187Q170 79 170 68Z",
  ],
  [
    "cloud-right",
    "Right cloud",
    "M302 114Q304 100 321 100Q326 83 348 85Q364 86 372 101Q391 101 391 113Q391 125 376 125H317Q302 125 302 114Z",
  ],
  ["planet", "Small planet", "M456 65A24 24 0 1 1 408 65A24 24 0 1 1 456 65Z"],
  ["moon", "Moon", "M632 108A66 66 0 1 1 500 108A66 66 0 1 1 632 108Z"],
  [
    "crater-upper",
    "Upper crater",
    "M575 73A13 13 0 1 1 549 73A13 13 0 1 1 575 73Z",
  ],
  [
    "crater-left",
    "Left crater",
    "M543 112A15 15 0 1 1 513 112A15 15 0 1 1 543 112Z",
  ],
  [
    "crater-lower",
    "Lower crater",
    "M603 128A19 19 0 1 1 565 128A19 19 0 1 1 603 128Z",
  ],
  [
    "mountains",
    "Mountains",
    "M17 330L88 241L131 286L202 217L286 331L361 259L451 339L548 233L615 292L703 216V373H17Z",
  ],
  [
    "peak-left",
    "Left mountain face",
    "M52 285L88 241L131 286L108 277L92 294L76 272Z",
  ],
  [
    "peak-center",
    "Center mountain face",
    "M322 298L361 259L400 294L381 287L367 303L351 286Z",
  ],
  [
    "peak-right",
    "Right mountain face",
    "M506 279L548 233L589 270L568 265L551 282L534 265Z",
  ],
  ["peak-edge", "Far-right mountain face", "M669 245L703 216V249L688 263Z"],
  [
    "ground",
    "Ground",
    "M17 358Q125 328 225 361T435 358T616 356Q664 345 703 350V442Q703 454 690 454H29Q17 454 17 442Z",
  ],
  [
    "foreground",
    "Foreground",
    "M17 399Q111 419 211 398T425 405T613 406Q658 394 703 391V442Q703 454 690 454H29Q17 454 17 442Z",
  ],
  [
    "ground-stone-left",
    "Left ground stone",
    "M64 427Q70 409 96 414Q108 418 117 428Q102 440 66 433Z",
  ],
  [
    "ground-stone-right",
    "Right ground stone",
    "M425 431Q442 412 460 418Q480 422 484 433Q467 442 427 439Z",
  ],
  [
    "flower-left-petal-top",
    "Flower petal",
    "M88 350Q96 337 104 350L105 365H87Z",
  ],
  [
    "flower-left-petal-right",
    "Flower petal",
    "M102 366Q115 357 121 370L108 381L97 373Z",
  ],
  [
    "flower-left-petal-bottom",
    "Flower petal",
    "M88 375H105L108 391Q96 404 86 390Z",
  ],
  [
    "flower-left-petal-left",
    "Flower petal",
    "M84 366L92 373L79 384Q66 377 74 365Z",
  ],
  [
    "flower-left-center",
    "Flower center",
    "M101 372A8 8 0 1 1 85 372A8 8 0 1 1 101 372Z",
  ],
  [
    "flower-right-petal-top",
    "Flower petal",
    "M665 359Q673 346 681 359L682 374H664Z",
  ],
  [
    "flower-right-petal-right",
    "Flower petal",
    "M679 375Q692 366 698 379L685 390L674 382Z",
  ],
  [
    "flower-right-petal-bottom",
    "Flower petal",
    "M665 384H682L685 400Q673 413 663 399Z",
  ],
  [
    "flower-right-petal-left",
    "Flower petal",
    "M661 375L669 382L656 393Q643 386 651 374Z",
  ],
  [
    "flower-right-center",
    "Flower center",
    "M678 381A8 8 0 1 1 662 381A8 8 0 1 1 678 381Z",
  ],
  [
    "cabinet",
    "Arcade cabinet",
    "M155 151Q155 142 165 142H332Q341 142 342 150L365 230L346 285V414H174V298L144 265V248Z",
  ],
  [
    "marquee",
    "Marquee",
    "M155 153Q155 142 165 142H331Q339 143 342 153L351 180H151Z",
  ],
  [
    "screen",
    "Game screen",
    "M171 194H331Q338 194 337 201L343 250Q343 255 336 255H167Q160 255 161 248L166 201Q166 194 171 194Z",
  ],
  [
    "screen-horizon",
    "Screen horizon",
    "M162 235Q195 214 250 240Q294 256 341 231L343 250Q343 255 336 255H167Q160 255 161 248Z",
  ],
  ["console", "Control deck", "M144 265H363L346 299H174Z"],
  [
    "control-left",
    "Left arcade button",
    "M225 281A9 9 0 1 1 207 281A9 9 0 1 1 225 281Z",
  ],
  [
    "control-center",
    "Center arcade button",
    "M277 281A9 9 0 1 1 259 281A9 9 0 1 1 277 281Z",
  ],
  [
    "control-right",
    "Right arcade button",
    "M326 281A9 9 0 1 1 308 281A9 9 0 1 1 326 281Z",
  ],
  ["cabinet-panel", "Cabinet front panel", "M199 319H321V390H199Z"],
  [
    "coin-slot",
    "Coin slot",
    "M244 344Q244 338 250 338H269Q275 338 275 344V367Q275 373 269 373H250Q244 373 244 367Z",
  ],
  [
    "saucer",
    "Flying saucer",
    "M434 353Q438 332 467 323Q476 290 521 291Q567 290 577 320Q623 331 630 352Q634 374 536 380Q432 378 434 353Z",
  ],
  [
    "dome",
    "Saucer dome",
    "M468 323Q476 290 521 291Q567 290 577 320Q535 344 468 323Z",
  ],
  [
    "saucer-light-left",
    "Left saucer light",
    "M468 354A11 7 0 1 1 490 354A11 7 0 1 1 468 354Z",
  ],
  [
    "saucer-light-center",
    "Center saucer light",
    "M522 357A11 7 0 1 1 544 357A11 7 0 1 1 522 357Z",
  ],
  [
    "saucer-light-right",
    "Right saucer light",
    "M576 353A11 7 0 1 1 598 353A11 7 0 1 1 576 353Z",
  ],
  [
    "star",
    "Star",
    "M405 130L413 151L434 157L414 166L408 188L398 168L376 164L396 152Z",
  ],
  [
    "ticket",
    "Prize ticket",
    "M575 401L632 397L640 428L584 438L582 427Q590 423 579 419Z",
  ],
];

export function initColoringGame({ complete, getModel }) {
  const root = document.querySelector("#llama-canvas");
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const toggle = root.querySelector("#canvas-toggle");
  const clear = root.querySelector("#canvas-clear");
  const direction = root.querySelector("#canvas-brief");
  const colorPicker = root.querySelector("#canvas-color");
  const status = root.querySelector("#canvas-status");
  const counter = root.querySelector("#canvas-count");
  const inspect = root.querySelector("#canvas-json");
  const regions = poster.map(([id, title, path]) => ({
    id,
    title,
    path: new Path2D(path),
  }));
  const fills = new Map();
  let run;
  let timer;

  function drawPoster() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "round";
    for (const region of regions) {
      ctx.fillStyle = fills.get(region.id) ?? "#fffdf7";
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3.5;
      ctx.fill(region.path);
      ctx.stroke(region.path);
    }

    counter.textContent = `${fills.size} / ${regions.length} colored`;
  }

  function humanPaint(region) {
    if (!region) return;
    fills.set(region.id, colorPicker.value);
    drawPoster();
    status.textContent =
      fills.size === regions.length
        ? "Illustration colored. You can still change any color."
        : `You colored ${region.title.toLowerCase()} ${colorPicker.value}.`;
    update();
  }

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const region = regions.findLast(({ path }) =>
      ctx.isPointInPath(path, x, y),
    );
    humanPaint(region);
  });

  function remaining() {
    return regions.filter(({ id }) => !fills.has(id));
  }

  function update() {
    if (run && run.model !== getModel()) {
      stop("Model changed. Start model coloring to continue.");
      return;
    }
    toggle.disabled = !run && (!getModel() || !remaining().length);
    toggle.textContent = run ? "Pause model" : "Start model coloring";
  }

  function stop(message) {
    clearTimeout(timer);
    run?.controller.abort();
    run = undefined;
    status.textContent = message;
    update();
  }

  async function next(current) {
    const options = remaining();
    if (!options.length) {
      stop(
        fills.size === regions.length
          ? "Illustration colored. You can still change any color."
          : "The model finished coloring. You can still change any color.",
      );
      return;
    }
    const { id, title } = options[0];
    const observation = {
      artDirection: current.brief,
      target: { id, title },
      coloredRegions: Object.fromEntries(fills),
    };
    try {
      const request = colorRequest({
        brief: current.brief,
        target: observation.target,
        coloredRegions: observation.coloredRegions,
      });
      const data = await complete(
        current.model,
        request,
        AbortSignal.any([
          current.controller.signal,
          AbortSignal.timeout(30000),
        ]),
      );
      if (run !== current) return;
      const content = data.choices?.[0]?.message?.content;
      inspect.textContent = JSON.stringify(
        { observation, request, reply: content },
        null,
        2,
      );
      const mark = JSON.parse(content);
      const region = options.find(
        (region) => region.id === id && region.id === mark?.region,
      );
      if (
        !region ||
        typeof mark.color !== "string" ||
        !hexColor.test(mark.color)
      ) {
        throw new Error("The reply didn’t use an available region and color.");
      }
      mark.color = mark.color.toLowerCase();
      // A human may have painted this region while the request was pending.
      const painted = !fills.has(region.id);
      if (painted) fills.set(region.id, mark.color);
      inspect.textContent = JSON.stringify(
        { observation, request, mark },
        null,
        2,
      );
      drawPoster();
      status.textContent = painted
        ? `The model colored ${region.title.toLowerCase()} ${mark.color}.`
        : "Kept your color. The model is moving to the next area.";
      if (!remaining().length) {
        stop(
          fills.size === regions.length
            ? "Illustration colored. You can still change any color."
            : "The model finished coloring. You can still change any color.",
        );
      } else {
        timer = setTimeout(() => next(current), 700);
      }
    } catch (error) {
      if (run !== current) return;
      stop(
        `Coloring paused. ${error.name === "TimeoutError" ? "The model took too long." : error.message}`,
      );
    }
  }
  toggle.addEventListener("click", () => {
    if (run) {
      stop("Model paused. You can keep coloring.");
      return;
    }
    const model = getModel();
    if (!model || !remaining().length) return;
    run = {
      model,
      brief: direction.value.trim(),
      controller: new AbortController(),
    };
    status.textContent = "The model is choosing a color…";
    update();
    next(run);
  });
  clear.addEventListener("click", () => {
    fills.clear();
    stop("Poster reset.");
    inspect.textContent = "The latest color decision will appear here.";
    drawPoster();
  });
  direction.addEventListener("input", () => {
    if (run)
      stop(
        "Art direction changed. Start model coloring to use it for the remaining areas.",
      );
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && run)
      stop("Model coloring paused while this tab was hidden.");
  });
  drawPoster();
  update();
  return update;
}
