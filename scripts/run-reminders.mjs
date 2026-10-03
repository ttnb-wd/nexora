import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
try {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || secret.trim() !== secret) throw new Error('Configure CRON_SECRET with at least 32 characters.');
  const origin = new URL(process.env.APP_URL);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
      !(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
    throw new Error('APP_URL must be an HTTPS origin or local loopback HTTP origin.');
  }
  const response = await fetch(new URL('/api/internal/reminders/run', origin), {
    method: 'POST', headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) throw new Error(`Reminder job failed (HTTP ${response.status}). Check server configuration and retry.`);
  const result = await response.json();
  console.log(JSON.stringify(Object.fromEntries(['processed', 'delivered', 'skipped', 'failed'].map(key => [key, result[key]]))));
} catch (error) {
  // Network errors may contain URLs; only our known local messages are printable.
  console.error(error.message.startsWith('Configure ') || error.message.startsWith('APP_URL ') || error.message.startsWith('Reminder job failed') ? error.message : 'Reminder job unavailable. Check the running server.');
  process.exitCode = 1;
}
