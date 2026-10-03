// Test-only preload. Never imported by application code. Hard stop for real
// Resend traffic in every child server/runtime suite, regardless of live env.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input);
  if (url.hostname === 'api.resend.com') {
    return new Response(JSON.stringify({ name: 'validation_error', message: 'Mocked email provider failure.' }), { status: 403 });
  }
  return originalFetch(input, options);
};
