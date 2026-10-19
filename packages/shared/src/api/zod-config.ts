import { z } from 'zod';

/*
 * Browsers run the web app under a Content-Security-Policy without
 * 'unsafe-eval'. zod probes for code generation with `Function('')` on first
 * use; the CSP blocks it (correctly) but reports a violation each time. In the
 * browser, skip the probe and validate without generated code; servers keep it.
 */
if ('document' in globalThis) z.config({ jitless: true });
