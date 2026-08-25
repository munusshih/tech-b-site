import type { CollectionEntry } from "astro:content";

export function getWeekYearAndSlug(id: string): {
  year: number;
  slug: string;
} {
  const [yearSegment, ...slugParts] = id.split("/");
  return { year: Number(yearSegment), slug: slugParts.join("/") };
}

export function isPublishedWeek(post: CollectionEntry<"weeks">): boolean {
  const { year, slug } = getWeekYearAndSlug(post.id);
  const segments = slug.split("/");
  return (
    Number.isInteger(year) &&
    Boolean(slug) &&
    segments.every((segment) => !segment.startsWith("_")) &&
    post.data.draft !== true
  );
}

export function isPublishedTutorial(
  tutorial: CollectionEntry<"tutorials">,
): boolean {
  return (
    tutorial.id.split("/").every((segment) => !segment.startsWith("_")) &&
    tutorial.data.draft !== true
  );
}

export function disableSubmissionLinks(html: string): string {
  return html.replace(
    /<a\b([^>]*?)href=(['"])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before, _quote, href, after, label) => {
      const plainLabel = String(label)
        .replace(/<[^>]*>/g, "")
        .trim();
      const isForm = /(?:forms\.gle|docs\.google\.com\/forms)/i.test(href);
      const isSubmissionAction = /\bsubmit\b/i.test(plainLabel);
      if (!isForm && !isSubmissionAction) return full;

      const cleanedAttributes = `${before}${after}`
        .replace(/\s*target=(['"])[\s\S]*?\1/gi, "")
        .replace(/\s*rel=(['"])[\s\S]*?\1/gi, "")
        .replace(
          /\s*class=(['"])(.*?)\1/i,
          (_match, quote, classes) =>
            ` class=${quote}${classes} archived-submission${quote}`,
        );
      const hasClass = /\bclass=/.test(cleanedAttributes);
      return `<span${cleanedAttributes}${hasClass ? "" : ' class="archived-submission"'} aria-disabled="true">${label}<span class="sr-only"> (closed; archived)</span></span>`;
    },
  );
}
