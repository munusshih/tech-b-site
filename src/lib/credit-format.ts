export interface CreditTextSegment {
  type: "text";
  value: string;
}

export interface CreditLinkSegment {
  type: "link";
  url: string;
  label: string;
  text: string;
}

export type CreditSegment = CreditTextSegment | CreditLinkSegment;

const linkPattern =
  /https?:\/\/[^\s<>“”]+|\bdoi\s*:\s*10\.\d{4,9}\/[^\s<>“”]+/gi;

function trimLink(rawLink: string): string {
  let link = rawLink;

  while (/[.,;:!?\]}'"”’]$/.test(link)) {
    link = link.slice(0, -1);
  }

  while (link.endsWith(")")) {
    const openingCount = (link.match(/\(/g) ?? []).length;
    const closingCount = (link.match(/\)/g) ?? []).length;
    if (closingCount <= openingCount) break;
    link = link.slice(0, -1);
  }

  return link;
}

function getLinkLabel(value: string): string {
  try {
    const url = new globalThis.URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    if (hostname === "youtu.be" || hostname.endsWith("youtube.com")) {
      return "YouTube";
    }
    if (hostname === "editor.p5js.org") return "p5.js Editor";
    if (hostname.endsWith("p5js.org")) return "p5.js Reference";
    if (hostname === "openprocessing.org") return "OpenProcessing";
    if (hostname === "doi.org") return "DOI";
    if (hostname.endsWith("figma.com")) return "Figma";
    if (hostname === "chatgpt.com" || hostname.endsWith("openai.com")) {
      return "ChatGPT";
    }
    if (hostname === "docs.google.com") return "Google Docs";
    if (hostname === "drive.google.com") return "Google Drive";

    return hostname;
  } catch {
    return "source";
  }
}

export function formatCreditText(value: string): CreditSegment[] {
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  const segments: CreditSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(linkPattern)) {
    const rawLink = match[0];
    const cleanLink = trimLink(rawLink);
    const matchIndex = match.index;
    const before = text.slice(cursor, matchIndex);

    if (before) segments.push({ type: "text", value: before });

    const url = /^doi\s*:/i.test(cleanLink)
      ? `https://doi.org/${cleanLink.match(/10\.\d{4,9}\/.+/i)?.[0] ?? ""}`
      : cleanLink;
    segments.push({
      type: "link",
      url,
      label: getLinkLabel(url),
      text: cleanLink,
    });

    const trailingPunctuation = rawLink.slice(cleanLink.length);
    if (trailingPunctuation) {
      segments.push({ type: "text", value: trailingPunctuation });
    }
    cursor = matchIndex + rawLink.length;
  }

  const remaining = text.slice(cursor);
  if (remaining) segments.push({ type: "text", value: remaining });

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}
