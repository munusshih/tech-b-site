const DEFAULT_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 15000;

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("Google Sheets returned malformed CSV");
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

export function parseCsvRows(text) {
  const [headers, ...records] = parseCsv(text);
  if (!headers?.length || headers.every((header) => !header.trim())) {
    throw new Error("Google Sheets CSV did not include a header row");
  }

  return records
    .filter((record) => record.some((value) => value.trim()))
    .map((record) =>
      Object.fromEntries(
        headers.map((header, index) => [header, record[index] ?? ""]),
      ),
    );
}

function directCsvUrl(apiUrl) {
  const url = new globalThis.URL(apiUrl);
  if (url.hostname !== "opensheet.elk.sh") return null;

  const [sheetId, ...tabParts] = url.pathname.split("/").filter(Boolean);
  if (!sheetId || !tabParts.length) return null;

  const tab = decodeURIComponent(tabParts.join("/"));
  const selector = /^\d+$/.test(tab)
    ? `gid=${encodeURIComponent(tab)}`
    : `sheet=${encodeURIComponent(tab)}`;

  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&${selector}`;
}

async function fetchWithTimeout(fetchFn, url, timeoutMs) {
  const controller = new globalThis.AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(url, { signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function fetchOpenSheetRows(
  fetchFn,
  apiUrl,
  {
    attempts = DEFAULT_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchFn, apiUrl, timeoutMs);
      if (!response.ok) {
        throw new Error(
          `OpenSheet request failed with HTTP ${response.status}`,
        );
      }

      const rows = await response.json();
      if (!Array.isArray(rows)) {
        throw new Error("OpenSheet returned an unexpected response shape");
      }

      return rows;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `OpenSheet attempt ${attempt}/${attempts} failed (${error.message}); retrying in ${delayMs}ms...`,
      );
      await wait(delayMs);
    }
  }

  const csvUrl = directCsvUrl(apiUrl);
  if (!csvUrl) throw lastError;

  console.warn(
    `OpenSheet remained unavailable (${lastError.message}); trying Google Sheets directly...`,
  );

  try {
    const response = await fetchWithTimeout(fetchFn, csvUrl, timeoutMs);
    if (!response.ok) {
      throw new Error(
        `Google Sheets request failed with HTTP ${response.status}`,
      );
    }

    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType.includes("text/html")) {
      throw new Error("Google Sheets returned an HTML page instead of CSV");
    }

    const rows = parseCsvRows(await response.text());
    console.log(`Fetched ${rows.length} rows directly from Google Sheets.`);
    return rows;
  } catch (fallbackError) {
    throw new Error(
      `${lastError.message}; direct Google Sheets fallback also failed: ${fallbackError.message}`,
      { cause: fallbackError },
    );
  }
}
