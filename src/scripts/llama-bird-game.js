/* global AbortController, AbortSignal, cancelAnimationFrame, document, performance, requestAnimationFrame */
import { createBirdPainter } from "./llama-bird-art.js";

const actions = ["flap", "glide"];
const moveTool = {
  type: "function",
  function: {
    name: "move_bird",
    description: "Advance the bird one turn by flapping or gliding.",
    parameters: {
      type: "object",
      properties: { action: { type: "string", enum: actions } },
      required: ["action"],
      additionalProperties: false,
    },
  },
};

const ticksPerTurn = 12;
const birdX = 82;
const radius = 10;
const pipeWidth = 45;
const pipeSpacing = 260;
const gapOffsets = [0, -23, 28, -10, 14];
const frameStep = 1000 / 60;

export function initBirdGame({ complete, getModel }) {
  const root = document.querySelector("#llama-bird");
  const canvas = root.querySelector("#bird-stage");
  const stage = root.querySelector("#bird-stage-control");
  const draw = createBirdPainter(canvas);
  const pilotControls = root.querySelector("#bird-pilot-controls");
  const flightLog = root.querySelector("#bird-flight-log");
  const scoreLabel = root.querySelector("#bird-score");
  const bestLabel = root.querySelector("#bird-best");
  const ask = root.querySelector("#bird-ask");
  const pause = root.querySelector("#bird-pause");
  const reset = root.querySelector("#bird-reset");
  const status = root.querySelector("#bird-status");
  const inspector = root.querySelector("#bird-inspector");
  const inspectorPanel = root.querySelector("#bird-inspect");
  const overlay = root.querySelector("#bird-overlay");
  const overlayTitle = root.querySelector("#bird-overlay-title");
  const overlayHint = root.querySelector("#bird-overlay-hint");
  const flapButton = root.querySelector("[data-bird-move]");
  const modeButtons = [...root.querySelectorAll("[data-bird-mode]")];
  const floor = canvas.height - 22;
  const best = { arcade: 0, llama: 0 };
  let game = initialState();
  let mode = "arcade";
  let phase = "ready";
  let flight;
  let turn = 0;
  let turnTicks = 0;
  let frame;
  let previousTime;
  let elapsed = 0;
  let lastRequest = null;
  let lastCall = null;

  function initialState() {
    return {
      y: floor / 2,
      velocity: 0,
      distance: 0,
      score: 0,
      crashed: false,
    };
  }

  function pipeAt(index, distance) {
    const center = floor / 2 + gapOffsets[index % gapOffsets.length];
    const halfGap = mode === "llama" ? 59 : Math.max(38, 53 - index);
    return {
      x: 301 + index * pipeSpacing - distance,
      center,
      top: center - halfGap,
      bottom: center + halfGap,
    };
  }

  function step(next) {
    next.velocity += 0.29;
    next.y += next.velocity;
    const speed =
      mode === "llama" ? 2.8 : Math.min(3.3, 2.05 + next.score * 0.06);
    next.distance += speed;

    const pipe = pipeAt(next.score, next.distance);
    const atPipe =
      birdX + radius > pipe.x && birdX - radius < pipe.x + pipeWidth;
    const outsideGap =
      next.y - radius < pipe.top || next.y + radius > pipe.bottom;
    if (
      next.y - radius < 0 ||
      next.y + radius > floor ||
      (atPipe && outsideGap)
    ) {
      next.crashed = true;
      return;
    }
    if (pipe.x + pipeWidth < birdX - radius) next.score++;
  }

  function supported(model) {
    return (
      model &&
      (!Array.isArray(model.capabilities) ||
        model.capabilities.includes("tools"))
    );
  }

  function updateControls() {
    const inArcade = mode === "arcade";
    const active = Boolean(flight);
    stage.disabled = !inArcade;
    flapButton.hidden = !inArcade;
    pilotControls.hidden = inArcade;
    ask.disabled = !active && !supported(getModel());
    ask.textContent = active
      ? "Stop autopilot"
      : phase === "paused"
        ? "Resume autopilot"
        : "Start autopilot";
    pause.hidden = !inArcade;
    pause.disabled = phase !== "running" && phase !== "paused";
    pause.textContent = phase === "paused" ? "Resume" : "Pause";
    inspectorPanel.hidden = inArcade || !lastRequest;
    flightLog.hidden = inArcade || !flightLog.childElementCount;
  }

  function paint() {
    const pipes = [];
    // Keep the cleared pipe on screen and let upcoming pipes scroll in from the right.
    for (let index = Math.max(0, game.score - 1); ; index++) {
      const pipe = pipeAt(index, game.distance);
      if (pipe.x > canvas.width + 4) break;
      if (pipe.x + pipeWidth + 4 > 0) pipes.push(pipe);
    }
    draw({ game, birdX, pipeWidth, pipes });
  }

  function updateScore() {
    best[mode] = Math.max(best[mode], game.score);
    scoreLabel.textContent = String(game.score);
    bestLabel.textContent = String(best[mode]);
  }

  function render() {
    paint();
    updateScore();
    overlay.hidden = phase === "running" || phase === "thinking";
    if (phase === "paused") {
      overlayTitle.textContent = "Paused";
      overlayHint.textContent =
        mode === "arcade"
          ? "Space or tap to resume"
          : "Resume autopilot to continue";
    } else if (game.crashed) {
      overlayTitle.textContent = "Flight over";
      overlayHint.textContent =
        mode === "arcade"
          ? "Space or tap to try again"
          : "Start autopilot to fly again";
    } else {
      overlayTitle.textContent =
        mode === "arcade" ? "Ready to fly?" : "Model Autopilot";
      overlayHint.textContent =
        mode === "arcade" ? "Space or tap to flap" : "Watch the model fly";
    }
    if (lastRequest) {
      inspector.textContent = JSON.stringify(
        { tool: moveTool, observation: lastRequest, modelReply: lastCall },
        null,
        2,
      );
    }
    updateControls();
  }

  function stopFrame() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    previousTime = undefined;
    elapsed = 0;
  }

  function animate(time) {
    if (phase !== "running") return;
    if (previousTime !== undefined)
      elapsed += Math.min(100, time - previousTime);
    previousTime = time;
    const oldScore = game.score;
    while (elapsed >= frameStep && !game.crashed) {
      if (flight && turnTicks === 0) break;
      elapsed -= frameStep;
      step(game);
      if (flight) turnTicks--;
    }

    if (game.crashed) {
      const pilot = Boolean(flight);
      stopAutopilot();
      phase = "crashed";
      status.textContent = `${pilot ? "The model cleared" : "You cleared"} ${game.score} ${game.score === 1 ? "pipe" : "pipes"} before crashing.`;
      render();
      return;
    }

    if (game.score !== oldScore) updateScore();
    paint();
    if (flight && turnTicks === 0) {
      stopFrame();
      requestMove(flight);
      return;
    }
    frame = requestAnimationFrame(animate);
  }

  function stopAutopilot() {
    flight?.controller.abort();
    flight = undefined;
    stopFrame();
  }

  function setPaused() {
    stopAutopilot();
    phase = "paused";
    status.textContent = "Flight paused.";
    render();
  }

  function flap() {
    if (mode !== "arcade") return;
    if (phase === "running") {
      game.velocity = -4.8;
      return;
    }
    const resuming = phase === "paused";
    if (!resuming) {
      game = initialState();
      game.velocity = -4.8;
    }
    phase = "running";
    status.textContent = "Flying.";
    render();
    frame = requestAnimationFrame(animate);
  }

  function modelHint() {
    const model = getModel();
    return !model
      ? "Click Find models above to connect a pilot."
      : supported(model)
        ? "Start autopilot to let the model fly."
        : "This model doesn’t support tools. Select a different model above.";
  }

  function resetGame() {
    stopAutopilot();
    game = initialState();
    turn = 0;
    turnTicks = 0;
    lastRequest = null;
    lastCall = null;
    flightLog.replaceChildren();
    phase = "ready";
    status.textContent =
      mode === "arcade"
        ? "Press Space on the game or tap the board to start."
        : modelHint();
    render();
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      if (button.dataset.birdMode === mode) return;
      mode = button.dataset.birdMode;
      for (const item of modeButtons)
        item.setAttribute(
          "aria-pressed",
          String(item.dataset.birdMode === mode),
        );
      resetGame();
    });
  }

  stage.addEventListener("click", flap);
  flapButton.addEventListener("click", flap);

  pause.addEventListener("click", () => {
    if (phase === "running") setPaused();
    else if (phase === "paused") flap();
  });
  reset.addEventListener("click", resetGame);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && (flight || phase === "running")) setPaused();
  });
  document.addEventListener("keydown", (event) => {
    if (
      mode !== "arcade" ||
      event.code !== "Space" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const target = event.target;
    const onFlap = target === stage || target === flapButton;
    if (!onFlap && (phase !== "running" || target !== document.body)) return;
    event.preventDefault();
    if (!event.repeat) flap();
  });

  function observe() {
    const pipe = pipeAt(game.score, game.distance);
    const targetY = pipe.center;
    const options = actions.map((action) => {
      const next = { ...game };
      if (action === "flap") next.velocity = -4.8;
      for (let tick = 0; tick < ticksPerTurn && !next.crashed; tick++)
        step(next);
      return {
        action,
        yAfterMove: Math.round(next.y),
        collision: next.crashed,
        distanceFromGap: Math.round(Math.abs(next.y - targetY)),
      };
    });
    // Rank the predicted options for the model. Only its returned call can move the bird.
    options.sort(
      (a, b) =>
        Number(a.collision) - Number(b.collision) ||
        a.distanceFromGap - b.distanceFromGap,
    );
    return {
      turn: turn + 1,
      birdY: Math.round(game.y),
      gapCenterY: targetY,
      pixelsToPipe: Math.round(pipe.x - birdX),
      pipesCleared: game.score,
      suggestedAction: options[0].action,
      optionsSafestFirst: options,
    };
  }

  function logMove(action, started) {
    const item = document.createElement("li");
    const call = document.createElement("code");
    call.textContent = `move_bird("${action}")`;
    item.append(
      `Turn ${turn}  `,
      call,
      `  ${Math.round(performance.now() - started)} ms`,
    );
    flightLog.prepend(item);
    if (flightLog.childElementCount > 5) flightLog.lastElementChild.remove();
  }

  async function requestMove(run) {
    phase = "thinking";
    const observation = observe();
    lastRequest ??= observation;
    status.textContent = `Choosing move ${observation.turn}…`;
    render();
    const started = performance.now();
    try {
      const data = await complete(
        run.model,
        {
          stream: false,
          tools: [moveTool],
          tool_choice: {
            type: "function",
            function: { name: moveTool.function.name },
          },
          temperature: 0,
          max_tokens: 128,
          messages: [
            {
              role: "system",
              content: "Pilot a bird by calling the move_bird tool.",
            },
            {
              role: "user",
              content:
                "Call move_bird to move the bird. Use the suggested action if it is safe: " +
                JSON.stringify(observation),
            },
          ],
        },
        AbortSignal.any([run.controller.signal, AbortSignal.timeout(20000)]),
      );
      if (flight !== run) return;

      lastRequest = observation;
      lastCall = data.choices?.[0]?.message ?? null;
      const calls = lastCall?.tool_calls ?? [];
      let call = calls[0]?.function;
      // Some Ollama model templates return the call envelope as JSON in content.
      const encodedCall =
        !calls.length &&
        run.model.runtime.name === "Ollama" &&
        lastCall?.content?.trim().startsWith("{");
      if (encodedCall) call = JSON.parse(lastCall.content);
      const args =
        typeof call?.arguments === "string"
          ? JSON.parse(call.arguments)
          : call?.arguments;
      const action = args?.action;
      if (
        (calls.length !== 1 && !encodedCall) ||
        call?.name !== moveTool.function.name ||
        !actions.includes(action)
      ) {
        throw new Error("The model didn’t return one valid move_bird call.");
      }

      turn++;
      turnTicks = ticksPerTurn;
      if (action === "flap") game.velocity = -4.8;
      logMove(action, started);
      phase = "running";
      status.textContent = `Turn ${turn}: the model chose ${action}.`;
      render();
      frame = requestAnimationFrame(animate);
    } catch (error) {
      if (flight !== run) return;
      stopAutopilot();
      phase = "paused";
      status.textContent =
        error.name === "TimeoutError"
          ? "The model took too long to move. Resume to try again."
          : error.name === "SyntaxError"
            ? "The move arguments weren’t valid JSON. Inspect the reply or resume to try again."
            : `Autopilot paused. ${error.name === "TypeError" ? `Check that ${run.model.runtime.name} is open.` : error.message}`;
      render();
    }
  }

  ask.addEventListener("click", () => {
    if (flight) {
      setPaused();
      return;
    }
    const model = getModel();
    if (mode !== "llama" || !supported(model)) return;
    if (phase !== "paused") resetGame();
    flight = { model, controller: new AbortController() };
    requestMove(flight);
  });

  render();

  return () => {
    updateControls();
    if (mode === "llama" && phase === "ready") status.textContent = modelHint();
  };
}
