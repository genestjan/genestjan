// Public, build-time configuration. Everything here ends up in the browser
// bundle, so it must never contain a private key.
const env = import.meta.env;
const list = (v: string | undefined, fallback: string[]) =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;

export const config = {
  osrmBikeUrl: env.VITE_OSRM_BIKE_URL || 'https://routing.openstreetmap.de/routed-bike',
  routeProxyUrl: env.VITE_ROUTE_PROXY_URL || '',
  overpassUrls: list(env.VITE_OVERPASS_URLS, [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]),
  nominatimUrl: env.VITE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  openMeteoUrl: env.VITE_OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast',
  tileUrl: env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution:
    env.VITE_TILE_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || '',
  defaultTimeZone: 'Asia/Manila',
};
