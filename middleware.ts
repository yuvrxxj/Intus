import { next } from '@vercel/functions';
import { authEntryRedirect, WAITLIST_HREF, webAuthEnabled } from './src/features/auth/webAuth.ts';

/**
 * Server redirect for the public auth addresses. Runs on Vercel before the SPA rewrite.
 * Local `vite` and `vite preview` apply the same rule in `vite.config.ts`.
 * Temporary (307, not stored) so turning `VITE_WEB_AUTH_ENABLED` on does not fight a cached permanent redirect.
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
  ],
};

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
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
