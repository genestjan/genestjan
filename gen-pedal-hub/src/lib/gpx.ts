import type { Point, Ride } from '../types.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A GPX file other apps (Strava, Komoot, Garmin) can import. */
export function toGpx(ride: Ride, points: Point[]): string {
  const pts = points
    .map((p) => {
      const ele = p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : '';
      return `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${ele}<time>${new Date(p.t).toISOString()}</time></trkpt>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Gen Pedal Hub" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${esc(ride.title)}</name><time>${new Date(ride.startedAt).toISOString()}</time></metadata>
<trk><name>${esc(ride.title)}</name><type>cycling</type><trkseg>
${pts}
</trkseg></trk>
</gpx>
`;
}
