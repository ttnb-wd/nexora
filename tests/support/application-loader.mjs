import './typescript-loader.mjs';
import { registerHooks } from 'node:module';

// Node runtime diagnostics load the real server modules, with Next's alias and
// server-only marker resolution. Database implementations are never substituted.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export%20default%20{}', shortCircuit: true };
    if (specifier.startsWith('@/')) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
