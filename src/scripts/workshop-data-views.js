// Reusable result views. Model output becomes text and attributes, never HTML.
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const money = (cents) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
export function budgetReceipt(value) {
  const receipt = node("div", undefined, "workshop-receipt");
  const table = node("table");
  const head = node("thead"),
    header = node("tr");
  for (const label of ["Material", "Qty", "Amount"])
    header.append(node("th", label));
  head.append(header);
  table.append(head);
  const body = node("tbody");
  for (const line of value.lines) {
    const row = node("tr");
    row.append(
      node("td", `${line.label} (${money(line.cents)} each)`),
      node("td", line.quantity),
      node("td", money(line.subtotal)),
    );
    body.append(row);
  }
  const total = node("tr", undefined, "workshop-receipt__total");
  const label = node("th", "Total");
  label.colSpan = 2;
  total.append(label, node("td", money(value.total)));
  body.append(total);
  table.append(body);
  receipt.append(table);
  receipt.append(
    node(
      "p",
      value.remaining >= 0
        ? `${money(value.remaining)} left from your ${money(value.budget)} budget.`
        : `${money(-value.remaining)} over your ${money(value.budget)} budget.`,
    ),
  );
  return receipt;
}
export function layoutPreview(value) {
  const figure = node("figure", undefined, "workshop-layout-preview");
  const svgNode = (tag, attributes, text) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, val] of Object.entries(attributes))
      el.setAttribute(key, val);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const svg = svgNode("svg", {
    viewBox: "-20 -20 1040 680",
    role: "img",
    "aria-label":
      "Tested positions in an eight by six metre toy exhibition room",
  });
  svg.append(svgNode("title", {}, "Floor-plan checker preview"));
  svg.append(
    svgNode("rect", {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      class: "workshop-layout__room",
    }),
  );
  svg.append(
    svgNode("rect", {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      class: "workshop-layout__entrance",
    }),
  );
  svg.append(
    svgNode(
      "text",
      { x: 12, y: 30, class: "workshop-layout__label" },
      "Keep clear",
    ),
  );
  for (const [i, box] of value.boxes.entries()) {
    svg.append(
      svgNode("rect", {
        x: box.x * 100,
        y: box.y * 100,
        width: box.width * 100,
        height: box.height * 100,
        class: `workshop-layout__station workshop-layout__station--${i}`,
      }),
    );
    svg.append(
      svgNode(
        "text",
        {
          x: box.x * 100 + 10,
          y: box.y * 100 + 30,
          class: "workshop-layout__label",
        },
        box.label,
      ),
    );
    svg.append(
      svgNode(
        "text",
        {
          x: box.x * 100 + 10,
          y: box.y * 100 + 60,
          class: "workshop-layout__dimension",
        },
        `${box.width} × ${box.height} m`,
      ),
    );
  }
  figure.append(svg);
  const caption = node(
    "figcaption",
    value.valid
      ? "All three checks pass: inside the room, no overlaps, entrance clear."
      : "The checker found these issues:",
  );
  if (value.issues.length) {
    const list = node("ul");
    for (const issue of value.issues) list.append(node("li", issue));
    caption.append(list);
  }
  figure.append(caption);
  return figure;
}
