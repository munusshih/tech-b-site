import { annotate } from "rough-notation";
import { element } from "./common.js";
export function mount(host) {
  let annotations = [],
    frame;
  function update(state) {
    cancelAnimationFrame(frame);
    annotations.forEach((n) => n.remove());
    annotations = [];
    host.replaceChildren();
    host.className = "archive-wall";
    const exhibition = state.exhibitions.at(-1);
    if (!exhibition) {
      const empty = element("div", "archive-empty");
      empty.append(
        element("span", "archive-empty-mark", "✂"),
        element("p", "archive-empty-title", "Three objects. One argument."),
        element(
          "p",
          "",
          "Your selection is the beginning, not the explanation.",
        ),
      );
      host.append(empty);
      return;
    }
    const heading = element("div", "archive-heading");
    heading.append(
      element("p", "archive-kicker", "An exhibition from borrowed objects"),
      element("h3", "archive-title", exhibition.title),
    );
    host.append(heading);
    const introduction = element("div", "archive-introduction");
    exhibition.introduction
      .split(/\n+/)
      .filter(Boolean)
      .forEach((p) => introduction.append(element("p", "", p)));
    host.append(introduction);
    const gallery = element("div", "archive-gallery");
    exhibition.objects.forEach((item, index) => {
      const record = exhibition.sources.find((o) => o.id === item.id);
      const figure = element("figure", "archive-work"),
        frame = element("div", "archive-frame"),
        image = document.createElement("img");
      image.src = record.image;
      image.alt = `${record.title}, ${record.artist}, ${record.date}`;
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () =>
        image.replaceWith(
          element(
            "p",
            "archive-image-unavailable",
            "The image is unavailable. Its original record is linked below.",
          ),
        ),
      );
      frame.append(image);
      const caption = element("figcaption");
      const title = element("a", "archive-object-title", record.title);
      title.href = record.url;
      title.target = "_blank";
      title.rel = "noopener noreferrer";
      const fact = element("span", "archive-fact", item.fact),
        quote = element("p", "archive-quote");
      quote.append(fact);
      const details = element("details", "archive-record");
      details.append(
        element("summary", "", "Collection record"),
        element(
          "p",
          "archive-object-info",
          `${record.artist}, ${record.date}. ${record.medium}`,
        ),
        element("p", "archive-credit", record.credit),
      );
      caption.append(
        element("p", "archive-work-number", String(index + 1).padStart(2, "0")),
        title,
        element("p", "archive-maker", `${record.artist} / ${record.date}`),
        element("p", "archive-caption", item.caption),
        quote,
        details,
      );
      figure.append(frame, caption);
      gallery.append(figure);
      annotations.push(
        annotate(fact, {
          type: index === 1 ? "highlight" : "underline",
          color: index === 1 ? "#fff0a6" : "#6f56bb",
          animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
          strokeWidth: 2,
          padding: 2,
          multiline: true,
        }),
      );
    });
    host.append(gallery);
    const editorial = element("details", "archive-editorial");
    editorial.append(element("summary", "", "Inside the editorial room"));
    const research = exhibition.editorial.research;
    for (const [name, text] of [
      ["Curator", exhibition.editorial.proposal.argument],
      [
        "Researcher",
        research.review ||
          [research.supported, research.corrections]
            .filter(Boolean)
            .join("\n\n"),
      ],
    ]) {
      editorial.append(element("h4", "", name), element("p", "", text));
    }
    host.append(editorial);
    frame = requestAnimationFrame(() => annotations.forEach((n) => n.show()));
  }
  return {
    update,
    destroy() {
      cancelAnimationFrame(frame);
      annotations.forEach((n) => n.remove());
      host.replaceChildren();
    },
  };
}
