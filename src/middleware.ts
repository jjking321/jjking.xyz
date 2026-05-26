// Guards /admin/* and /api/admin/* routes. Unauthenticated requests to
// admin pages get redirected to /admin/login; unauthenticated API requests
// get a 401 JSON response.
import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated } from '@lib/auth';

const PUBLIC_ADMIN_PATHS = new Set([
  '/admin/login',
  '/admin/login/',
  '/api/admin/login',
]);

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const path = url.pathname;
  const needsAuth =
    (path === '/admin' || path === '/admin/' || path.startsWith('/admin/') || path.startsWith('/api/admin/')) &&
    !PUBLIC_ADMIN_PATHS.has(path);

  if (!needsAuth) return next();

  const ok = await isAuthenticated(cookies);
  if (ok) return next();

  if (path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const next_ = encodeURIComponent(path + url.search);
  return redirect(`/admin/login?next=${next_}`);
});
