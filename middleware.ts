import { next } from '@vercel/functions';
import { authEntryRedirect, WAITLIST_HREF, webAuthEnabled } from './src/features/auth/webAuth.ts';
import { DEFAULT_SUPABASE_URL, isOneClickUnsubscribe, oneClickUnsubscribe } from './src/features/home/unsubscribePost.ts';

/**
 * Server redirect for the public auth addresses. Runs on Vercel before the SPA rewrite.
 * Local `vite` and `vite preview` apply the same rule in `vite.config.ts`.
 * Temporary (307, not stored) so turning `VITE_WEB_AUTH_ENABLED` on does not fight a cached permanent redirect.
 *
 * Also the one-click unsubscribe button in mail apps (INT-163): a POST to /waitlist/unsubscribe is handed to the
 * join-waitlist function. A GET there is the page, untouched.
 */
export const config = {
  matcher: [
    '/signin',
    '/signin/',
    '/signin/:path*',
    '/login',
    '/login/',
    '/login/:path*',
    '/signup',
    '/signup/',
    '/signup/:path*',
    '/register',
    '/register/',
    '/register/:path*',
    '/auth',
    '/auth/',
    '/auth/:path*',
    '/waitlist/unsubscribe',
    '/waitlist/unsubscribe/',
  ],
};

export default function middleware(request: Request): Response | Promise<Response> {
  const url = new URL(request.url);
  if (isOneClickUnsubscribe(request.method, url.pathname)) {
    return oneClickUnsubscribe(request.url, fetch, process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY || undefined);
  }
  const target = authEntryRedirect(url.pathname, url.search, webAuthEnabled(process.env.VITE_WEB_AUTH_ENABLED));
  if (!target || (request.method !== 'GET' && request.method !== 'HEAD')) return next();
  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(WAITLIST_HREF, request.url).href,
      'Cache-Control': 'no-store',
    },
  });
}
