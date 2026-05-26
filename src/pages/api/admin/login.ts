export const prerender = false;
import type { APIRoute } from 'astro';
import { checkPassword, createSession } from '@lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/admin');

  if (!process.env.ADMIN_PASSWORD) {
    return redirect('/admin/login?error=setup');
  }
  if (!checkPassword(password)) {
    return redirect('/admin/login?error=1');
  }
  await createSession(cookies);
  // Only allow same-origin redirects
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
  return redirect(safeNext);
};
