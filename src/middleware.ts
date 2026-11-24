import { defineMiddleware } from 'astro:middleware';

// The static site still connects directly to the user's local server. During
// local Astro development, use a same-origin loopback proxy just like the ZIP.
export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  if (!import.meta.env.DEV || !['/api/playground', '/api/model'].includes(url.pathname)) return next();
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!localHost || (request.headers.get('origin') && request.headers.get('origin') !== url.origin)) return json(403, { error: 'Use the local playground origin.' });
  if (url.pathname === '/api/playground') return json(200, { localPlayground: true });
  if (request.method !== 'POST' || !request.headers.get('content-type')?.startsWith('application/json')) return json(415, { error: 'JSON POST required.' });
  try {
    const input = await request.text();
    if (input.length > 150000) return json(413, { error: 'Request too large.' });
    const { base, path, body } = JSON.parse(input);
    const target = new URL(base);
    if (target.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.username || target.password) return json(400, { error: 'Use a loopback model server.' });
    if (!['/v1/models', '/v1/chat/completions', '/v1/embeddings'].includes(path)) return json(400, { error: 'Unsupported model route.' });
    const upstream = await fetch(target.origin + path, {
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return json(502, { error: e instanceof Error ? e.message : 'Local model request failed.' });
  }
});
