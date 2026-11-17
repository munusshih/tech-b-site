function ellipse(ctx, x, y, rx, ry, fill, angle = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fill();
}

function ridge(ctx, base, amplitude, shift, width, height, color) {
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 8) {
    ctx.lineTo(
      x,
      base +
        Math.sin((x + shift) / 48) * amplitude +
        Math.sin((x + shift) / 22) * 5,
    );
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function createBirdPainter(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const { width, height } = canvas;
  const floor = height - 22;
  const sky = ctx.createLinearGradient(0, 0, 0, floor);
  sky.addColorStop(0, "#292449");
  sky.addColorStop(0.56, "#8279b4");
  sky.addColorStop(1, "#f0bba7");

  function pole(x, width, y, length, lip) {
    const sheen = ctx.createLinearGradient(x, 0, x + width, 0);
    sheen.addColorStop(0, "#312847");
    sheen.addColorStop(0.23, "#79689b");
    sheen.addColorStop(0.72, "#524471");
    sheen.addColorStop(1, "#312847");
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, width, length);
    ctx.fillStyle = "#28213d";
    ctx.fillRect(x - 4, lip, width + 8, 9);
    ctx.fillStyle = "#b19bc8";
    ctx.fillRect(x - 4, lip + 2, width + 8, 2);
    ctx.fillStyle = "#ffffff26";
    ctx.fillRect(x + 7, y, 3, length);
  }

  return ({ game, birdX, pipeWidth, pipes }) => {
    const { distance } = game;
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 22; i++) {
      const x =
        (((i * 137) % width) - ((distance * 0.08) % width) + width) % width;
      ellipse(ctx, x, 16 + ((i * 41) % 133), i % 5 ? 1 : 2, 1, "#fff1dcaa");
    }
    ellipse(ctx, 373, 66, 47, 47, "#ffdfba22");
    ellipse(ctx, 373, 66, 38, 38, "#ffe0bf");
    ridge(ctx, floor - 49, 17, distance * 0.16, width, floor, "#675582");
    ridge(ctx, floor - 23, 11, distance * 0.31 + 60, width, floor, "#43375e");

    for (const { x, top, bottom } of pipes) {
      pole(x, pipeWidth, 0, top, top - 9);
      pole(x, pipeWidth, bottom, floor - bottom, bottom);
    }

    ctx.fillStyle = "#2d2744";
    ctx.fillRect(0, floor, width, height - floor);
    for (let x = -(distance % 25); x < width; x += 25) {
      ctx.fillStyle = "#62537c";
      ctx.fillRect(x, floor + 9, 14, 2);
    }
    ctx.fillStyle = "#ead0b4";
    ctx.fillRect(0, floor, width, 3);

    ctx.save();
    ctx.translate(birdX, game.y);
    ctx.rotate(Math.max(-0.35, Math.min(0.65, game.velocity * 0.09)));
    ellipse(ctx, -1, 2, 16, 12, "#30253e", -0.08);
    ellipse(ctx, 0, 0, 14, 10, game.crashed ? "#bd756d" : "#ffd06f", -0.08);
    ellipse(ctx, -6, 3, 7, 4, "#c87162", -0.43 + Math.sin(distance / 6) * 0.26);
    ellipse(ctx, 6, -3, 4, 4, "#fff7dc");
    ellipse(ctx, 7, -3, 1.6, 2, "#30253e");
    ctx.fillStyle = "#ea8758";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(19, 3);
    ctx.lineTo(10, 6);
    ctx.fill();
    ctx.restore();
  };
}
