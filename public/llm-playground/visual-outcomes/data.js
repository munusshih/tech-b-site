// Public, read-only data endpoints; no credentials or paid service is involved.
async function getJSON(url, signal) {
  const res = await fetch(url, {
    signal: signal || AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw Error(
      `Public data request failed (${res.status}). Try again in a moment.`,
    );
  return res.json();
}
export async function fetchArtworks(topic, signal) {
  signal ||= AbortSignal.timeout(20000);
  const allowed = ["moon", "birds", "flowers", "water"];
  if (!allowed.includes(topic))
    throw Error("Choose one of the collection subjects.");
  const base = "https://collectionapi.metmuseum.org/public/collection";
  const search = await getJSON(
    `${base}/v1.1/search?hasImages=true&isHighlight=true&limit=18&q=${encodeURIComponent(topic)}`,
    signal,
  );
  const records = [];
  const ids = (search.objectIDs || []).slice(0, 18);
  for (let i = 0; i < ids.length && records.length < 6; i += 3) {
    const batch = await Promise.allSettled(
      ids
        .slice(i, i + 3)
        .map((id) => getJSON(`${base}/v1/objects/${id}`, signal)),
    );
    if (signal?.aborted) throw signal.reason;
    for (const r of batch) {
      if (r.status !== "fulfilled") continue;
      const o = r.value;
      if (!o.isPublicDomain || !o.primaryImageSmall) continue;
      const image = new URL(o.primaryImageSmall),
        url = new URL(o.objectURL);
      if (
        image.protocol !== "https:" ||
        image.hostname !== "images.metmuseum.org" ||
        url.protocol !== "https:" ||
        !["www.metmuseum.org", "metmuseum.org"].includes(url.hostname)
      )
        continue;
      records.push({
        id: String(o.objectID),
        title: String(o.title).slice(0, 200),
        artist: o.artistDisplayName || "Maker not recorded",
        date: o.objectDate || "Date not recorded",
        medium: o.medium || "Material not recorded",
        image: image.href,
        url: url.href,
        credit: o.creditLine || "The Metropolitan Museum of Art, New York",
      });
    }
  }
  if (records.length < 3)
    throw Error(
      "This search didn’t return three available public-domain images. Try another subject.",
    );
  return records.slice(0, 6);
}
