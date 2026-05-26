// Tiny signed-cookie session: HMAC-SHA256 over a JSON payload with an
// expiration. No DB, no JWT lib, no third-party dependency.
//
// Env vars expected:
//   ADMIN_PASSWORD       — plaintext password to compare against
//   ADMIN_SESSION_SECRET — random 32+ char string used to HMAC the cookie
//
// Cookie format: `<base64url(payload)>.<hex(HMAC)>`
// Payload is JSON: { exp: number (ms epoch) }

import type { AstroCookies } from 'astro';

const COOKIE_NAME = 'admin_session';
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    // In dev, fall back to a dev-only secret so login still works without env
    // setup. Logs a warning so it's not silently insecure in prod.
    if (process.env.NODE_ENV !== 'production') {
      return 'dev-only-insecure-secret-change-me-please-32chars';
    }
    throw new Error('ADMIN_SESSION_SECRET env var is not set or too short');
  }
  return s;
}

export async function createSession(cookies: AstroCookies): Promise<void> {
  const payload = JSON.stringify({ exp: Date.now() + TTL_MS });
  const payloadB64 = b64urlEncode(enc.encode(payload));
  const sig = await hmac(getSecret(), payloadB64);
  const value = `${payloadB64}.${hex(sig)}`;
  cookies.set(COOKIE_NAME, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_MS / 1000,
  });
}

export function destroySession(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export async function isAuthenticated(cookies: AstroCookies): Promise<boolean> {
  const raw = cookies.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const [payloadB64, sigHex] = raw.split('.');
  if (!payloadB64 || !sigHex) return false;
  try {
    const expectedSig = await hmac(getSecret(), payloadB64);
    const givenSig = fromHex(sigHex);
    if (!timingSafeEqual(expectedSig, givenSig)) return false;
    const payload = JSON.parse(dec.decode(b64urlDecode(payloadB64)));
    if (typeof payload?.exp !== 'number' || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function checkPassword(submitted: string): boolean {
  const real = process.env.ADMIN_PASSWORD ?? '';
  if (!real) return false;
  const a = enc.encode(submitted);
  const b = enc.encode(real);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
