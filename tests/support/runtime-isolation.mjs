// Older runtime suites predate per-suite IP isolation. Keep their authentication
// requests separate without changing the real application's rate-limit policy.
const originalFetch = globalThis.fetch;
if (process.env.NEXORA_RUNTIME_IP) globalThis.fetch = (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input);
  if (['localhost','127.0.0.1'].includes(url.hostname)) {
    const headers = new Headers(options.headers);
    if (!headers.has('X-Forwarded-For')) headers.set('X-Forwarded-For', process.env.NEXORA_RUNTIME_IP);
    return originalFetch(input, { ...options, headers });
  }
  return originalFetch(input, options);
};
