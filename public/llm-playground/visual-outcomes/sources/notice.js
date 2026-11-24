import { gsap } from "gsap";
import { element, downloadFile, escapeHTML } from "./common.js";
export function mount(host) {
  let current, tween, previous;
  function update(state) {
    current = state.notices.at(-1);
    tween?.kill();
    host.replaceChildren();
    host.className = "notice-desk";
    const paper = element("article", "notice-paper");
    const mast = element("div", "notice-mast");
    mast.append(
      element("span", "notice-emblem", "§"),
      element("p", "notice-department", "Department of\nShared Concerns"),
      element("span", "notice-internal", "Internal\ncircular"),
    );
    paper.append(mast);
    if (!current) {
      paper.classList.add("notice-awaiting");
      paper.append(
        element(
          "p",
          "notice-subject",
          "Regarding: that thing you’ve been meaning to say",
        ),
        element(
          "p",
          "notice-headline",
          "Your grievance deserves a letterhead.",
        ),
        element("div", "notice-blank"),
        element("p", "notice-stamp", "Awaiting submission"),
      );
      host.append(paper);
      return;
    }
    paper.append(
      element("p", "notice-subject", `Regarding / ${current.subject}`),
      element("h3", "notice-headline", current.headline),
    );
    const body = element("div", "notice-body");
    current.body
      .split(/\n+/)
      .filter(Boolean)
      .forEach((p) => body.append(element("p", "", p)));
    paper.append(body);
    const foot = element("div", "notice-foot");
    foot.append(
      element(
        "p",
        "notice-closing",
        /^(none|null|n\/a)$/i.test(current.closing.trim())
          ? ""
          : current.closing,
      ),
      element("span", "notice-stamp", "For your\nconsideration"),
    );
    paper.append(
      foot,
      element(
        "p",
        "notice-reference",
        `Fictional correspondence / ${current.date} / ${String(state.notices.length).padStart(3, "0")}`,
      ),
    );
    host.append(paper);
    if (
      current.headline !== previous &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      tween = gsap.from(paper, {
        y: 22,
        rotation: -1,
        opacity: 0,
        duration: 0.6,
        ease: "power3.out",
        clearProps: "all",
      });
    previous = current.headline;
  }
  return {
    update,
    download() {
      if (!current) return;
      const css =
        ".sheet{max-width:660px;margin:60px auto;padding:50px;border:1px solid #bcb1d0;color:#263137;background:#faf8ff;font-family:Georgia,serif}header{font-size:18px;border-bottom:3px double;padding-bottom:25px}h1{font-size:48px;line-height:1.05}p{font-size:19px;line-height:1.65;white-space:pre-line}footer{border-top:1px solid;margin-top:35px;font-style:italic}";
      downloadFile(
        "announcement.html",
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(current.headline)}</title><style>${css}</style><article class="sheet"><header>Department of Shared Concerns / Fictional correspondence</header><p>Regarding: ${escapeHTML(current.subject)}</p><h1>${escapeHTML(current.headline)}</h1><p>${escapeHTML(current.body)}</p><footer><p>${escapeHTML(current.closing)}</p></footer></article></html>`,
        "text/html",
      );
    },
    destroy() {
      tween?.kill();
      host.replaceChildren();
    },
  };
}
