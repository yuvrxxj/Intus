import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import { authEntryRedirect, webAuthEnabled } from './src/features/auth/webAuth.ts';

/** Same rule as `middleware.ts`: a closed auth address redirects before the SPA is served. */
function authEntryRedirectPlugin(mode: string): Plugin {
  const enabled = webAuthEnabled(loadEnv(mode, process.cwd(), 'VITE_').VITE_WEB_AUTH_ENABLED);
  const redirect: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const raw = req.url ?? '/';
    const queryAt = raw.indexOf('?');
    const pathname = queryAt === -1 ? raw : raw.slice(0, queryAt);
    const search = queryAt === -1 ? '' : raw.slice(queryAt);
    const target = authEntryRedirect(pathname, search, enabled);
    if (!target) return next();
    res.statusCode = 307;
    res.setHeader('Location', target);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
  };
  return {
    name: 'auth-entry-redirect',
    configureServer(server) { server.middlewares.use(redirect); },
    configurePreviewServer(server) { server.middlewares.use(redirect); },
  };
}

/** `/photoassets` is a static page. The preview server's SPA fallback would otherwise show the homepage there. */
function photoassetsPage(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = req.url?.split('?')[0];
    if (path === '/photoassets') req.url = '/photoassets/index.html';
    next();
  };
  return {
    name: 'photoassets-page',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [authEntryRedirectPlugin(mode), react(), tailwindcss(), photoassetsPage()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022' },
}));
