// Supabase Edge Function: proxies openrouteservice so the ORS key never
// reaches the browser. Deploy:
//   supabase secrets set ORS_API_KEY=... ALLOWED_ORIGIN=https://genestjanramirez.com
//   supabase functions deploy route-proxy --no-verify-jwt
// Then set VITE_ROUTE_PROXY_URL=https://<project>.functions.supabase.co/route-proxy

const ORS_URL = 'https://api.openrouteservice.org/v2/directions';
const PROFILES = new Set(['cycling-road', 'cycling-regular', 'cycling-mountain', 'cycling-electric']);
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://genestjanramirez.com';

// Best-effort per-instance rate limit: 20 requests per IP per 10 minutes.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

const cors = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  Vary: 'Origin',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: { message: 'POST only' } });
  const origin = req.headers.get('origin');
  if (origin && origin !== allowedOrigin && !origin.startsWith('http://localhost')) return json(403, { error: { message: 'Origin not allowed' } });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (limited(ip)) return json(429, { error: { message: 'Too many route requests. Try again in a few minutes.' } });

  const key = Deno.env.get('ORS_API_KEY');
  if (!key) return json(503, { error: { message: 'Routing proxy not configured.' } });

  let body: { profile?: string; coordinates?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { message: 'Invalid JSON' } });
  }
  const profile = body.profile ?? 'cycling-road';
  const coords = body.coordinates;
  const valid =
    PROFILES.has(profile) &&
    Array.isArray(coords) &&
    coords.length >= 2 &&
    coords.length <= 10 &&
    coords.every((c) => Array.isArray(c) && c.length === 2 && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90);
  if (!valid) return json(400, { error: { message: 'Need 2-10 [lng, lat] coordinates and a cycling profile.' } });

  const res = await fetch(`${ORS_URL}/${profile}/geojson`, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: coords,
      elevation: true,
      instructions: true,
      extra_info: ['surface', 'waytype', 'steepness'],
      alternative_routes: coords.length === 2 ? { target_count: 3, share_factor: 0.6, weight_factor: 1.6 } : undefined,
    }),
  });
  const text = await res.text();
  // Never echo the key or upstream headers back.
  return new Response(text, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
});
