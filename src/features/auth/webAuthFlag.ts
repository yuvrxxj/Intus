import { webAuthEnabled } from './webAuth.ts';

/**
 * Baked into the browser bundle at build time. Unset means off.
 * Routing middleware reads the same variable at request time. Both update on the next deploy.
 */
export const WEB_AUTH_ENABLED = webAuthEnabled(import.meta.env.VITE_WEB_AUTH_ENABLED);
