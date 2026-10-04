// Test-only preload. Never imported by application code. Hard stop for real
// Resend traffic in every child server/runtime suite, regardless of live env.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input);
  if (url.hostname === 'api.resend.com') {
    if (process.env.NEXORA_AUTH_EMAIL_MOCK === '1' && ['Verify your Nexora email','Reset your Nexora password'].includes(JSON.parse(options.body ?? '{}').subject)) return new Response(JSON.stringify({id:'auth-regression-mocked'}), {status:200});
    return new Response(JSON.stringify({ name: 'validation_error', message: 'Mocked email provider failure.' }), { status: 403 });
  }
  return originalFetch(input, options);
};
