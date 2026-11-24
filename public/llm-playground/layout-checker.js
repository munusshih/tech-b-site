// A toy exhibition floor: dimensions in metres, not a construction plan.
export const stations = {
  listening: { width: 2, height: 2, label: "Listening" },
  table: { width: 3, height: 2, label: "Making table" },
  wall: { width: 2, height: 1, label: "Wall display" },
};
const entrance = { x: 0, y: 0, width: 2, height: 2 };
const overlaps = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
export function checkLayout(placements) {
  if (!Array.isArray(placements) || placements.length !== 3)
    throw new Error(
      "Provide exactly the three named stations.",
    );
  const seen = new Set();
  const boxes = placements.map(({ id, x, y }) => {
    if (
      !Object.hasOwn(stations, id) ||
      seen.has(id) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      throw new Error("Invalid station or coordinates.");
    seen.add(id);
    return { id, x, y, ...stations[id] };
  });
  const issues = [];
  for (const box of boxes) {
    if (
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.width > 8 ||
      box.y + box.height > 6
    )
      issues.push(
        `${box.id} extends beyond the 8 × 6 room. Use x between 0 and ${8 - box.width}, y between 0 and ${6 - box.height}.`,
      );
    if (overlaps(box, entrance))
      issues.push(
        `${box.id} blocks the entrance zone. Move it to x >= 2 or y >= 2.`,
      );
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (overlaps(boxes[i], boxes[j]))
        issues.push(
          `${boxes[i].id} overlaps ${boxes[j].id}. Move ${boxes[j].id} right to x >= ${boxes[i].x + boxes[i].width}, or down to y >= ${boxes[i].y + boxes[i].height}; stay inside the room.`,
        );
  return {
    kind: "layout",
    boxes,
    entrance,
    issues,
    valid: !issues.length,
  };
}
