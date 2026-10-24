// Test-only keys for the throwaway local stack. Never use these anywhere real.
import crypto from 'node:crypto';
export const JWT_SECRET = 'local-test-secret-not-for-production-0123456789';
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
export function sign(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' }); const body = b64(payload);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
const year = 3600 * 24 * 365;
export const ANON_KEY = sign({ role: 'anon', iss: 'supabase', iat: 1700000000, exp: 1700000000 + 20 * year });
export const SERVICE_KEY = sign({ role: 'service_role', iss: 'supabase', iat: 1700000000, exp: 1700000000 + 20 * year });
if (process.argv[2] === 'anon') console.log(ANON_KEY);
if (process.argv[2] === 'service') console.log(SERVICE_KEY);
