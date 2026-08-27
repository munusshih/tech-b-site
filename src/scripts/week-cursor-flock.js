/* global document, window */

const IDLE_DELAY_MS = 30000;
const INITIAL_DELAY_MS = IDLE_DELAY_MS;
const FRAME_INTERVAL_MS = 1000 / 30;
const POPULATION_INTERVAL_MS = 6000;
const ENTRY_DURATION_MS = 850;
const EXIT_DURATION_MS = 1150;
const INITIAL_INTERACTION_DELAY = [6500, 10000];
const INTERACTION_GAP = [11000, 18000];
const INTERACTIONS = [
  { kind: "chat", speaker: "hi", listener: "hi!" },
  { kind: "chat", speaker: "this way?", listener: "okay" },
  { kind: "chat", speaker: "found it", listener: "show me" },
  { kind: "chat", speaker: "wait up", listener: "coming" },
  {
    kind: "handoff",
    speaker: "follow me this time!",
    listener: "okay, your turn",
    nextLeader: "speaker",
  },
  {
    kind: "handoff",
    speaker: "want to lead?",
    listener: "my turn!",
    nextLeader: "listener",
  },
  { kind: "fight", speaker: "hey, that's mine!", listener: "no way!" },
  { kind: "fight", speaker: "move!", listener: "you move!" },
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function chooseInteraction() {
  const roll = Math.random();
  const kind = roll < 0.08 ? "fight" : roll < 0.2 ? "handoff" : "chat";
  return randomItem(
    INTERACTIONS.filter((interaction) => interaction.kind === kind),
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initializeFlock(canvas) {
  if (
    !(canvas instanceof window.HTMLCanvasElement) ||
    canvas.dataset.flockReady === "true"
  ) {
    return;
  }

  const content = document.querySelector("#week-content");
  const context = canvas.getContext("2d", { alpha: true });
  if (!content || !context) return;

  canvas.dataset.flockReady = "true";

  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const forcedColorsQuery = window.matchMedia("(forced-colors: active)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const controller = new window.AbortController();
  const { signal } = controller;

  const rootStyles = window.getComputedStyle(document.documentElement);
  const palette = {
    paper: rootStyles.getPropertyValue("--sketch-paper").trim() || "#f2effc",
    ink: rootStyles.getPropertyValue("--sketch-ink").trim() || "#182f36",
    accent: rootStyles.getPropertyValue("--sketch-accent").trim() || "#6f56bb",
    fight: "#96384a",
  };

  const state = {
    agents: [],
    bounds: null,
    conversation: null,
    nextConversationAt: 0,
    leaderIndex: 0,
    leaderUntil: 0,
    leaderTrail: [],
    lastTrailAt: 0,
    lastFrameAt: 0,
    lastInputAt: window.performance.now() - (IDLE_DELAY_MS - INITIAL_DELAY_MS),
    animationFrame: 0,
    idleTimer: 0,
    visible: false,
    phase: "hidden",
    entryStartedAt: 0,
    exitStartedAt: 0,
    printing: false,
    embeddedHoverHolds: new Set(),
    embeddedFocusHolds: new Set(),
    destroyed: false,
  };

  function isMotionBlocked() {
    return (
      reducedMotionQuery.matches || forcedColorsQuery.matches || state.printing
    );
  }

  function isEmbeddedContentHeld() {
    return (
      state.embeddedHoverHolds.size > 0 || state.embeddedFocusHolds.size > 0
    );
  }

  function getAgentLimits() {
    if (coarsePointerQuery.matches) return { base: 2, max: 5 };
    if (window.innerWidth < 640) return { base: 3, max: 7 };
    if (window.innerWidth < 1024) return { base: 4, max: 9 };
    return { base: 5, max: 12 };
  }

  function targetAgentCount(now) {
    const limits = getAgentLimits();
    const settledIdleTime = Math.max(
      0,
      now - state.lastInputAt - IDLE_DELAY_MS,
    );
    const idleAdditions = Math.floor(settledIdleTime / POPULATION_INTERVAL_MS);
    const clampedAdditions = Math.min(limits.max - limits.base, idleAdditions);
    canvas.dataset.idleLevel = String(clampedAdditions);
    return limits.base + clampedAdditions;
  }

  function resizeCanvas() {
    const dpr = Math.max(1, Math.min(1.75, window.devicePixelRatio || 1));
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function measureContentBounds() {
    const rect = content.getBoundingClientRect();
    const gutter = window.innerWidth < 640 ? 10 : 18;
    const left = Math.max(gutter, rect.left + gutter);
    const right = Math.min(window.innerWidth - gutter, rect.right - gutter);
    const top = Math.max(gutter, rect.top + gutter);
    const bottom = Math.min(window.innerHeight - gutter, rect.bottom - gutter);

    if (right - left < 100 || bottom - top < 100) return null;
    return { left, right, top, bottom };
  }

  function refreshBounds() {
    state.bounds = measureContentBounds();
    if (!state.bounds) return;

    for (const agent of state.agents) {
      agent.x = clamp(agent.x, state.bounds.left, state.bounds.right);
      agent.y = clamp(agent.y, state.bounds.top, state.bounds.bottom);
    }
  }

  function activateLeader(index, now, duration = randomBetween(24000, 36000)) {
    state.leaderIndex = clamp(index, 0, Math.max(0, state.agents.length - 1));
    state.leaderUntil = now + duration;
    state.leaderTrail = [];
    state.lastTrailAt = 0;
    canvas.dataset.leader = String(
      state.agents[state.leaderIndex]?.id || state.leaderIndex + 1,
    );
  }

  function chooseNextLeader(now) {
    const previousLeader = state.leaderIndex;
    let nextLeader = previousLeader;
    if (state.agents.length > 1) {
      do {
        nextLeader = Math.floor(Math.random() * state.agents.length);
      } while (nextLeader === previousLeader);
    }
    activateLeader(nextLeader, now);
  }

  function createAgent(index, enterFromEdge = false) {
    if (!state.bounds) return;

    const centerX = (state.bounds.left + state.bounds.right) * 0.5;
    const centerY = (state.bounds.top + state.bounds.bottom) * 0.5;
    let x = randomBetween(state.bounds.left, state.bounds.right);
    let y = randomBetween(state.bounds.top, state.bounds.bottom);
    if (enterFromEdge) {
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) x = state.bounds.left;
      if (edge === 1) x = state.bounds.right;
      if (edge === 2) y = state.bounds.top;
      if (edge === 3) y = state.bounds.bottom;
    }

    const angle = enterFromEdge
      ? Math.atan2(centerY - y, centerX - x) + randomBetween(-0.35, 0.35)
      : randomBetween(0, Math.PI * 2);
    const speed = randomBetween(16, 27);
    return {
      id: index + 1,
      color: "#ffffff",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      maxSpeed: randomBetween(31, 43),
      phase: randomBetween(0, Math.PI * 2),
      scale: randomBetween(0.88, 1.22),
      wanderStrength: randomBetween(0.72, 1.35),
      sway: randomBetween(0.035, 0.095),
      opacity: 1,
    };
  }

  function stageAgentsForEntry(now) {
    if (!state.bounds) return;
    const centerX = (state.bounds.left + state.bounds.right) * 0.5;
    const centerY = (state.bounds.top + state.bounds.bottom) * 0.5;

    for (const agent of state.agents) {
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) {
        agent.x = state.bounds.left;
        agent.y = randomBetween(state.bounds.top, state.bounds.bottom);
      } else if (edge === 1) {
        agent.x = state.bounds.right;
        agent.y = randomBetween(state.bounds.top, state.bounds.bottom);
      } else if (edge === 2) {
        agent.x = randomBetween(state.bounds.left, state.bounds.right);
        agent.y = state.bounds.top;
      } else {
        agent.x = randomBetween(state.bounds.left, state.bounds.right);
        agent.y = state.bounds.bottom;
      }

      const angle =
        Math.atan2(centerY - agent.y, centerX - agent.x) +
        randomBetween(-0.28, 0.28);
      const speed = randomBetween(24, 36);
      agent.vx = Math.cos(angle) * speed;
      agent.vy = Math.sin(angle) * speed;
      agent.opacity = 0;
    }

    state.phase = "entering";
    state.entryStartedAt = now;
  }

  function stageAgentsForExit(now) {
    if (!state.bounds) return;

    for (const agent of state.agents) {
      const distances = [
        agent.x - state.bounds.left,
        state.bounds.right - agent.x,
        agent.y - state.bounds.top,
        state.bounds.bottom - agent.y,
      ];
      const nearestDistance = Math.min(...distances);
      const nearestEdges = distances
        .map((distance, edge) => ({ distance, edge }))
        .filter(({ distance }) => distance <= nearestDistance + 70);
      const edge = randomItem(nearestEdges).edge;
      const overshoot = randomBetween(24, 42);

      agent.exitFromX = agent.x;
      agent.exitFromY = agent.y;
      agent.exitX = agent.x;
      agent.exitY = agent.y;
      agent.exitDelay = randomBetween(0, 0.22);
      if (edge === 0) agent.exitX = state.bounds.left - overshoot;
      if (edge === 1) agent.exitX = state.bounds.right + overshoot;
      if (edge === 2) agent.exitY = state.bounds.top - overshoot;
      if (edge === 3) agent.exitY = state.bounds.bottom + overshoot;
    }

    state.phase = "exiting";
    state.exitStartedAt = now;
    canvas.dataset.state = "exiting";
  }

  function syncAgentPopulation(now, enterFromEdge = true) {
    if (!state.bounds) return;
    const targetCount = targetAgentCount(now);

    while (state.agents.length < targetCount) {
      const agent = createAgent(state.agents.length, enterFromEdge);
      if (!agent) break;
      state.agents.push(agent);
    }
    if (state.agents.length > targetCount) {
      state.agents.length = targetCount;
    }

    canvas.dataset.agentCount = String(state.agents.length);
    if (state.leaderIndex >= state.agents.length) {
      activateLeader(Math.max(0, state.agents.length - 1), now);
    }
  }

  function seedAgents(now) {
    if (!state.bounds) return;

    state.agents = [];
    syncAgentPopulation(now, false);
    state.leaderIndex = Math.floor(Math.random() * state.agents.length);
    activateLeader(state.leaderIndex, now);
    state.nextConversationAt =
      now + randomBetween(...INITIAL_INTERACTION_DELAY);
  }

  function prepareAgents(now) {
    if (state.agents.length === 0) {
      seedAgents(now);
    } else {
      refreshBounds();
      syncAgentPopulation(now);
      if (now >= state.leaderUntil) chooseNextLeader(now);
      state.nextConversationAt =
        now + randomBetween(...INITIAL_INTERACTION_DELAY);
    }
  }

  function findNearestAgent(source) {
    let nearest = null;
    let nearestDistance = Infinity;

    for (const candidate of state.agents) {
      if (candidate.id === source.id) continue;
      const distance = Math.hypot(
        candidate.x - source.x,
        candidate.y - source.y,
      );
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  function beginConversation(now) {
    if (state.agents.length < 2) return;
    const speaker = randomItem(state.agents);
    const listener = findNearestAgent(speaker);
    if (!listener) return;

    const interaction = chooseInteraction();
    state.conversation = {
      kind: interaction.kind,
      speakerId: speaker.id,
      listenerId: listener.id,
      speakerMessage: interaction.speaker,
      listenerMessage: interaction.listener,
      nextLeader: interaction.nextLeader || null,
      startedAt: now,
      endsAt:
        now +
        (interaction.kind === "fight"
          ? randomBetween(3400, 4500)
          : randomBetween(3800, 5200)),
    };
    canvas.dataset.conversation = "true";
    canvas.dataset.interaction = interaction.kind;
  }

  function updateConversation(now) {
    const conversation = state.conversation;
    if (conversation && now >= conversation.endsAt) {
      const speaker = state.agents.find(
        (agent) => agent.id === conversation.speakerId,
      );
      const listener = state.agents.find(
        (agent) => agent.id === conversation.listenerId,
      );
      if (speaker && listener) {
        if (conversation.kind === "fight") {
          const dx = listener.x - speaker.x;
          const dy = listener.y - speaker.y;
          const distance = Math.hypot(dx, dy) || 1;
          speaker.vx -= (dx / distance) * 24;
          speaker.vy -= (dy / distance) * 24;
          listener.vx += (dx / distance) * 24;
          listener.vy += (dy / distance) * 24;
        } else {
          listener.vx = listener.vx * 0.35 + speaker.vx * 0.65;
          listener.vy = listener.vy * 0.35 + speaker.vy * 0.65;
        }
      }
      if (conversation.kind === "handoff") {
        const nextLeaderId =
          conversation.nextLeader === "listener"
            ? conversation.listenerId
            : conversation.speakerId;
        const nextLeaderIndex = state.agents.findIndex(
          (agent) => agent.id === nextLeaderId,
        );
        if (nextLeaderIndex >= 0) {
          activateLeader(nextLeaderIndex, now, randomBetween(26000, 40000));
        }
      }
      state.conversation = null;
      canvas.dataset.conversation = "false";
      canvas.dataset.interaction = "none";
      state.nextConversationAt = now + randomBetween(...INTERACTION_GAP);
    } else if (!conversation && now >= state.nextConversationAt) {
      beginConversation(now);
    }
  }

  function recordLeaderTrail(now) {
    if (now - state.lastTrailAt < 110) return;
    const leader = state.agents[state.leaderIndex];
    if (!leader) return;

    state.leaderTrail.unshift({ x: leader.x, y: leader.y });
    state.leaderTrail.length = Math.min(state.leaderTrail.length, 36);
    state.lastTrailAt = now;
  }

  function updateAgents(deltaSeconds, now) {
    const bounds = state.bounds;
    if (!bounds || state.agents.length === 0) return;
    syncAgentPopulation(now);
    if (now >= state.leaderUntil) chooseNextLeader(now);

    updateConversation(now);
    recordLeaderTrail(now);

    const snapshot = state.agents.map((agent) => ({ ...agent }));
    const conversation = state.conversation;

    const accelerations = snapshot.map((agent, index) => {
      let accelerationX =
        Math.cos(now * 0.00055 + agent.phase) * 7 * agent.wanderStrength;
      let accelerationY =
        Math.sin(now * 0.00048 + agent.phase * 1.17) * 7 * agent.wanderStrength;
      let neighborCount = 0;
      let averageX = 0;
      let averageY = 0;
      let averageVx = 0;
      let averageVy = 0;

      for (const other of snapshot) {
        if (other.id === agent.id) continue;
        const dx = other.x - agent.x;
        const dy = other.y - agent.y;
        const distance = Math.hypot(dx, dy) || 1;

        if (distance < 175) {
          neighborCount += 1;
          averageX += other.x;
          averageY += other.y;
          averageVx += other.vx;
          averageVy += other.vy;
        }

        if (distance < 55) {
          const separation = (55 - distance) / 55;
          accelerationX -= (dx / distance) * separation * 42;
          accelerationY -= (dy / distance) * separation * 42;
        }
      }

      if (neighborCount > 0) {
        averageX /= neighborCount;
        averageY /= neighborCount;
        averageVx /= neighborCount;
        averageVy /= neighborCount;
        accelerationX += (averageX - agent.x) * 0.012;
        accelerationY += (averageY - agent.y) * 0.012;
        accelerationX += (averageVx - agent.vx) * 0.16;
        accelerationY += (averageVy - agent.vy) * 0.16;
      }

      if (index !== state.leaderIndex) {
        const trailIndex = Math.min(
          state.leaderTrail.length - 1,
          4 + index * 3,
        );
        const leader = snapshot[state.leaderIndex];
        const target = state.leaderTrail[trailIndex] || leader;
        if (target) {
          accelerationX += (target.x - agent.x) * 0.018;
          accelerationY += (target.y - agent.y) * 0.018;
        }
      }

      if (
        conversation &&
        (agent.id === conversation.speakerId ||
          agent.id === conversation.listenerId)
      ) {
        const partnerId =
          agent.id === conversation.speakerId
            ? conversation.listenerId
            : conversation.speakerId;
        const partner = snapshot.find((item) => item.id === partnerId);
        if (partner) {
          const dx = partner.x - agent.x;
          const dy = partner.y - agent.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (conversation.kind === "fight") {
            const fightPhase =
              (now - conversation.startedAt) * 0.008 + agent.phase * 0.25;
            const desiredDistance = 66 + Math.sin(fightPhase) * 25;
            const lungeForce = clamp(
              (distance - desiredDistance) * 0.4,
              -28,
              28,
            );
            const direction = agent.id === conversation.speakerId ? 1 : -1;
            accelerationX += (dx / distance) * lungeForce;
            accelerationY += (dy / distance) * lungeForce;
            accelerationX += (-dy / distance) * direction * 10;
            accelerationY += (dx / distance) * direction * 10;
          } else {
            if (distance > 82) {
              accelerationX += (dx / distance) * 18;
              accelerationY += (dy / distance) * 18;
            }
            accelerationX -= agent.vx * 0.16;
            accelerationY -= agent.vy * 0.16;
          }
        }
      }

      const boundaryPadding = 58;
      if (agent.x < bounds.left + boundaryPadding) {
        accelerationX += (bounds.left + boundaryPadding - agent.x) * 0.16;
      }
      if (agent.x > bounds.right - boundaryPadding) {
        accelerationX -= (agent.x - (bounds.right - boundaryPadding)) * 0.16;
      }
      if (agent.y < bounds.top + boundaryPadding) {
        accelerationY += (bounds.top + boundaryPadding - agent.y) * 0.16;
      }
      if (agent.y > bounds.bottom - boundaryPadding) {
        accelerationY -= (agent.y - (bounds.bottom - boundaryPadding)) * 0.16;
      }

      const magnitude = Math.hypot(accelerationX, accelerationY);
      const maxAcceleration = conversation?.kind === "fight" ? 58 : 52;
      if (magnitude > maxAcceleration) {
        accelerationX = (accelerationX / magnitude) * maxAcceleration;
        accelerationY = (accelerationY / magnitude) * maxAcceleration;
      }
      return { x: accelerationX, y: accelerationY };
    });

    state.agents.forEach((agent, index) => {
      const acceleration = accelerations[index];
      agent.vx += acceleration.x * deltaSeconds;
      agent.vy += acceleration.y * deltaSeconds;

      const speed = Math.hypot(agent.vx, agent.vy) || 1;
      if (speed > agent.maxSpeed) {
        agent.vx = (agent.vx / speed) * agent.maxSpeed;
        agent.vy = (agent.vy / speed) * agent.maxSpeed;
      }

      agent.x += agent.vx * deltaSeconds;
      agent.y += agent.vy * deltaSeconds;

      if (agent.x <= bounds.left || agent.x >= bounds.right) {
        agent.vx *= -0.72;
      }
      if (agent.y <= bounds.top || agent.y >= bounds.bottom) {
        agent.vy *= -0.72;
      }
      agent.x = clamp(agent.x, bounds.left, bounds.right);
      agent.y = clamp(agent.y, bounds.top, bounds.bottom);
    });
  }

  function updateEntry(now) {
    const progress = clamp(
      (now - state.entryStartedAt) / ENTRY_DURATION_MS,
      0,
      1,
    );
    const eased = 1 - (1 - progress) ** 3;
    for (const agent of state.agents) agent.opacity = eased;
    if (progress >= 1) state.phase = "active";
  }

  function updateExit(now) {
    const progress = clamp(
      (now - state.exitStartedAt) / EXIT_DURATION_MS,
      0,
      1,
    );

    for (const agent of state.agents) {
      const localProgress = clamp(
        (progress - agent.exitDelay) / (1 - agent.exitDelay),
        0,
        1,
      );
      const eased = localProgress * localProgress * (3 - 2 * localProgress);
      agent.x = agent.exitFromX + (agent.exitX - agent.exitFromX) * eased;
      agent.y = agent.exitFromY + (agent.exitY - agent.exitFromY) * eased;
      agent.opacity = 1 - localProgress;
    }

    if (progress >= 1) hideFlock("suppressed");
  }

  function roundedRect(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - safeRadius,
      y + height,
    );
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  function fillCursorShape(agent) {
    context.fillStyle = agent.color;
    context.strokeStyle = palette.ink;
    context.lineWidth = 1.35;
    context.fill();
    context.stroke();
  }

  function drawArrowShape(agent, size) {
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, size);
    context.lineTo(size * 0.24, size * 0.74);
    context.lineTo(size * 0.46, size * 1.22);
    context.lineTo(size * 0.62, size * 1.14);
    context.lineTo(size * 0.4, size * 0.66);
    context.lineTo(size * 0.82, size * 0.66);
    context.closePath();
    fillCursorShape(agent);

    context.save();
    context.globalAlpha *= 0.68;
    context.fillStyle = palette.paper;
    context.beginPath();
    context.arc(size * 0.17, size * 0.5, 1.25, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawCursor(agent, now) {
    const conversation = state.conversation;
    const isFighting =
      conversation?.kind === "fight" &&
      (agent.id === conversation.speakerId ||
        agent.id === conversation.listenerId);
    const isLeader = state.agents[state.leaderIndex]?.id === agent.id;
    const leaderPulse = isLeader ? 1.06 + Math.sin(now * 0.004) * 0.035 : 1;
    const size = 16 * agent.scale * leaderPulse;
    const fightJitter = isFighting
      ? Math.sin(now * 0.045 + agent.phase) * 1.8
      : 0;

    context.save();
    context.globalAlpha = agent.opacity ?? 1;
    context.translate(agent.x + fightJitter, agent.y - fightJitter * 0.55);
    context.rotate(Math.sin(now * 0.0012 + agent.phase) * agent.sway);
    context.shadowColor = "rgba(24, 47, 54, 0.2)";
    context.shadowBlur = 3;
    context.shadowOffsetY = 1.5;

    drawArrowShape(agent, size);
    context.restore();
  }

  function drawBubble(agent, message, side, verticalOffset = 0, tone = "chat") {
    const bounds = state.bounds;
    if (!bounds) return;

    context.save();
    context.font = "650 10.5px ui-monospace, SFMono-Regular, Menlo, monospace";
    const bubbleWidth = Math.ceil(context.measureText(message).width) + 19;
    const bubbleHeight = 25;
    const preferredX =
      side === "left" ? agent.x - bubbleWidth - 12 : agent.x + 16;
    const x = clamp(
      preferredX,
      bounds.left + 4,
      bounds.right - bubbleWidth - 4,
    );
    const y = clamp(
      agent.y - bubbleHeight - 16 + verticalOffset,
      bounds.top + 4,
      bounds.bottom - bubbleHeight - 4,
    );

    const bubbleColor = tone === "fight" ? palette.fight : palette.accent;
    const tailBaseX = side === "left" ? x + bubbleWidth - 12 : x + 12;
    const tailTipX =
      side === "left"
        ? Math.min(agent.x - 2, x + bubbleWidth + 9)
        : Math.max(agent.x + 2, x - 9);
    const tailTipY = Math.min(agent.y - 2, y + bubbleHeight + 10);

    context.shadowColor = "rgba(24, 47, 54, 0.2)";
    context.shadowBlur = 5;
    context.shadowOffsetY = 2;
    context.beginPath();
    context.moveTo(tailBaseX - 4, y + bubbleHeight - 2);
    context.lineTo(tailTipX, tailTipY);
    context.lineTo(tailBaseX + 4, y + bubbleHeight - 2);
    context.closePath();
    context.globalAlpha = 0.98;
    context.fillStyle = bubbleColor;
    context.fill();
    context.strokeStyle = palette.ink;
    context.lineWidth = 1;
    context.stroke();

    roundedRect(x, y, bubbleWidth, bubbleHeight, 7);
    context.fillStyle = bubbleColor;
    context.fill();
    context.stroke();
    context.shadowColor = "transparent";
    context.globalAlpha = 1;
    context.fillStyle = palette.paper;
    context.textBaseline = "middle";
    context.fillText(message, x + 9.5, y + bubbleHeight / 2 + 0.5);
    context.restore();
  }

  function drawConversation(now) {
    const conversation = state.conversation;
    if (!conversation) return;
    const speaker = state.agents.find(
      (agent) => agent.id === conversation.speakerId,
    );
    const listener = state.agents.find(
      (agent) => agent.id === conversation.listenerId,
    );
    if (!speaker || !listener) return;

    const progress = clamp(
      (now - conversation.startedAt) /
        (conversation.endsAt - conversation.startedAt),
      0,
      1,
    );

    const speakerIsLeft = speaker.x <= listener.x;
    drawBubble(
      speaker,
      conversation.speakerMessage,
      speakerIsLeft ? "left" : "right",
      -5,
      conversation.kind,
    );
    if (progress > 0.24) {
      drawBubble(
        listener,
        conversation.listenerMessage,
        speakerIsLeft ? "right" : "left",
        17,
        conversation.kind,
      );
    }
  }

  function drawFrame(now) {
    const bounds = state.bounds;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!bounds) return;

    context.save();
    context.beginPath();
    context.rect(
      bounds.left,
      bounds.top,
      bounds.right - bounds.left,
      bounds.bottom - bounds.top,
    );
    context.clip();
    for (const agent of state.agents) drawCursor(agent, now);
    drawConversation(now);
    context.restore();
  }

  function animate(now) {
    if (!state.visible || state.destroyed) return;
    state.animationFrame = window.requestAnimationFrame(animate);

    if (now - state.lastFrameAt < FRAME_INTERVAL_MS) return;
    const deltaSeconds = clamp((now - state.lastFrameAt) / 1000, 0.016, 0.05);
    state.lastFrameAt = now;
    if (state.phase === "exiting") {
      updateExit(now);
    } else {
      updateAgents(deltaSeconds, now);
      if (state.phase === "entering") updateEntry(now);
    }
    drawFrame(now);
  }

  function hideFlock(nextState = "suppressed") {
    state.visible = false;
    state.phase = "hidden";
    canvas.dataset.state = nextState;
    canvas.dataset.conversation = "false";
    canvas.dataset.interaction = "none";
    canvas.removeAttribute("data-active-conversation");
    state.conversation = null;
    if (state.animationFrame) {
      window.cancelAnimationFrame(state.animationFrame);
      state.animationFrame = 0;
    }
  }

  function showFlock() {
    if (
      state.destroyed ||
      isEmbeddedContentHeld() ||
      document.hidden ||
      isMotionBlocked()
    ) {
      return;
    }
    resizeCanvas();
    refreshBounds();
    if (!state.bounds) {
      hideFlock("offscreen");
      return;
    }

    const now = window.performance.now();
    prepareAgents(now);
    stageAgentsForEntry(now);
    state.visible = true;
    state.lastFrameAt = now - FRAME_INTERVAL_MS;
    canvas.dataset.state = "active";
    if (!state.animationFrame) {
      state.animationFrame = window.requestAnimationFrame(animate);
    }
  }

  function checkIdle() {
    state.idleTimer = 0;
    if (
      state.destroyed ||
      isEmbeddedContentHeld() ||
      isMotionBlocked() ||
      document.hidden
    ) {
      return;
    }

    const elapsed = window.performance.now() - state.lastInputAt;
    const remaining = IDLE_DELAY_MS - elapsed;
    if (remaining > 0) {
      state.idleTimer = window.setTimeout(checkIdle, remaining);
      return;
    }
    showFlock();
  }

  function scheduleIdleCheck(delay = IDLE_DELAY_MS) {
    if (state.idleTimer || state.destroyed || isMotionBlocked()) return;
    state.idleTimer = window.setTimeout(checkIdle, delay);
  }

  function markActivity() {
    state.lastInputAt = window.performance.now();
    if (isMotionBlocked()) {
      hideFlock(forcedColorsQuery.matches ? "forced-colors" : "reduced-motion");
      return;
    }
    if (state.visible && state.phase !== "exiting") {
      state.conversation = null;
      canvas.dataset.conversation = "false";
      canvas.dataset.interaction = "none";
      stageAgentsForExit(state.lastInputAt);
    } else if (!state.visible && canvas.dataset.state !== "suppressed") {
      hideFlock("suppressed");
    }
    scheduleIdleCheck();
  }

  function updateEmbeddedContentHold() {
    if (!isEmbeddedContentHeld()) {
      markActivity();
      return;
    }
    state.lastInputAt = window.performance.now();
    if (state.idleTimer) window.clearTimeout(state.idleTimer);
    state.idleTimer = 0;
    hideFlock("suppressed");
  }

  function holdEmbeddedHover(event) {
    state.embeddedHoverHolds.add(event.currentTarget);
    updateEmbeddedContentHold();
  }

  function releaseEmbeddedHover(event) {
    state.embeddedHoverHolds.delete(event.currentTarget);
    updateEmbeddedContentHold();
  }

  function holdEmbeddedFocus(event) {
    state.embeddedFocusHolds.add(event.currentTarget);
    updateEmbeddedContentHold();
  }

  function releaseEmbeddedFocus(event) {
    state.embeddedFocusHolds.delete(event.currentTarget);
    updateEmbeddedContentHold();
  }

  function handleMotionPreference() {
    if (isMotionBlocked()) {
      if (state.idleTimer) window.clearTimeout(state.idleTimer);
      state.idleTimer = 0;
      hideFlock(forcedColorsQuery.matches ? "forced-colors" : "reduced-motion");
      return;
    }
    markActivity();
  }

  function handleResize() {
    resizeCanvas();
    refreshBounds();
    markActivity();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      hideFlock("hidden");
    } else {
      markActivity();
    }
  }

  function handlePageHide(event) {
    if (event.persisted) {
      hideFlock("hidden");
      return;
    }
    destroy();
  }

  function handlePageShow(event) {
    if (event.persisted) markActivity();
  }

  function destroy() {
    state.destroyed = true;
    hideFlock("destroyed");
    if (state.idleTimer) window.clearTimeout(state.idleTimer);
    state.idleTimer = 0;
    controller.abort();
    resizeObserver?.disconnect();
  }

  const activityEvents = ["pointermove", "pointerdown", "wheel", "touchmove"];
  for (const eventName of activityEvents) {
    window.addEventListener(eventName, markActivity, { passive: true, signal });
  }
  window.addEventListener("scroll", markActivity, { passive: true, signal });
  window.addEventListener("keydown", markActivity, { signal });
  window.addEventListener("resize", handleResize, { passive: true, signal });
  window.addEventListener(
    "beforeprint",
    () => {
      state.printing = true;
      handleMotionPreference();
    },
    { signal },
  );
  window.addEventListener(
    "afterprint",
    () => {
      state.printing = false;
      handleMotionPreference();
    },
    { signal },
  );
  window.addEventListener("pagehide", handlePageHide, { signal });
  window.addEventListener("pageshow", handlePageShow, { signal });
  document.addEventListener("visibilitychange", handleVisibilityChange, {
    signal,
  });
  reducedMotionQuery.addEventListener("change", handleMotionPreference, {
    signal,
  });
  forcedColorsQuery.addEventListener("change", handleMotionPreference, {
    signal,
  });
  coarsePointerQuery.addEventListener("change", handleResize, { signal });

  content.querySelectorAll(".iframe-wrap, iframe").forEach((embed) => {
    embed.addEventListener("pointerenter", holdEmbeddedHover, {
      passive: true,
      signal,
    });
    embed.addEventListener("pointerleave", releaseEmbeddedHover, {
      passive: true,
      signal,
    });
  });
  content.querySelectorAll("iframe").forEach((embed) => {
    embed.addEventListener("focus", holdEmbeddedFocus, { signal });
    embed.addEventListener("blur", releaseEmbeddedFocus, { signal });
  });

  const resizeObserver =
    "ResizeObserver" in window
      ? new window.ResizeObserver(() => refreshBounds())
      : null;
  resizeObserver?.observe(content);

  resizeCanvas();
  refreshBounds();
  if (isMotionBlocked()) {
    handleMotionPreference();
  } else {
    scheduleIdleCheck(INITIAL_DELAY_MS);
  }
}

document
  .querySelectorAll("[data-week-cursor-flock]")
  .forEach((canvas) => initializeFlock(canvas));
