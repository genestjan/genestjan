/**
 * Public settings. Nothing here is secret: all of it ships inside the app.
 */

/** Map pictures. OpenStreetMap's own server is fine for light use; swap for a paid tile provider if the app gets busy. */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_CREDIT = '© OpenStreetMap';
/**
 * OpenStreetMap blocks apps that do not say who they are, so the phone app
 * sends this with every map picture. (A web browser sends its own.)
 */
export const TILE_HEADERS = {
  'User-Agent': 'GenRide/0.3 (+https://genestjanramirez.com/pedalhub/)',
  Referer: 'https://genestjanramirez.com/pedalhub/',
};
/** Used instead if OpenStreetMap still refuses a map picture. Free for light use. */
export const BACKUP_TILE_URL = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
export const BACKUP_TILE_CREDIT = '© OpenStreetMap © CARTO';

/** Looks up water points and bike shops from OpenStreetMap. Tried in order. */
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * The shared server (Supabase) used for accounts, community, rankings and events.
 * Both values are public by design: they ship inside every copy of the app, and
 * the database's own rules decide what a rider may read or change.
 * Leave both empty to run the app without those features.
 */
const DEFAULT_SUPABASE_URL = 'https://byizxdimzrekpbfwxovx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aXp4ZGltenJla3BiZnd4b3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NjUzMjAsImV4cCI6MjExMDQ0MTMyMH0.7JxBhgvjCiWbYEV-S_675FzbNdfe-fk6ICzvi4o_G4E';

// A build can point at a different server by setting these two variables.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
