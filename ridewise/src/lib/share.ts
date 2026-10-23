// Share links carry a read-only copy of the plan inside the URL fragment.
// The fragment is never sent to a server. Private rider data (emergency
// contacts, medical notes, rider profile) is not part of a RidePlan and
// participant names are stripped unless the organiser opts in.

import type { RidePlan } from '../types';
import { simplify } from './geo';

export type SharedPlan = Omit<RidePlan, 'candidates' | 'alternatives'> & { sharedAt: string };

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Response(data).body!.pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export function toShared(plan: RidePlan, includeNames = false): SharedPlan {
  const { candidates: _c, alternatives: _a, ...rest } = plan;
  return {
    ...rest,
    route: rest.route ? { ...rest.route, coords: simplify(rest.route.coords, 25), steps: undefined } : undefined,
    stops: rest.stops.map((s) => ({ ...s, place: { ...s.place, photo: undefined } })),
    group: { ...rest.group, participants: includeNames ? rest.group.participants : [], organizer: includeNames ? rest.group.organizer : undefined },
    sharedAt: new Date().toISOString(),
  };
}

export async function encodeShare(plan: RidePlan, includeNames = false): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toShared(plan, includeNames)));
  if (typeof CompressionStream !== 'undefined') return `z${b64url(await pipe(json, new CompressionStream('deflate-raw')))}`;
  return `j${b64url(json)}`;
}

export async function decodeShare(token: string): Promise<SharedPlan> {
  const kind = token[0];
  const bytes = fromB64url(token.slice(1));
  const raw = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  const plan = JSON.parse(new TextDecoder().decode(raw)) as SharedPlan;
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.stops)) throw new Error('This share link is damaged or incomplete.');
  return plan;
}
