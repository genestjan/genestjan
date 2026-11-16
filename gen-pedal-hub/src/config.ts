/**
 * Public settings. Nothing here is secret: all of it ships inside the app.
 */

/** Map pictures. OpenStreetMap's own server is fine for light use; swap for a paid tile provider if the app gets busy. */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_CREDIT = '© OpenStreetMap';

/** Looks up water points and bike shops from OpenStreetMap. Tried in order. */
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * The shared server (Supabase) used for accounts, community, rankings and events.
 * Both values are public by design. Leave empty to run the app without those features.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
