// Stand-in for Supabase's API gateway on :54321: /auth/v1 -> GoTrue :9999, /rest/v1 -> PostgREST :3000, with CORS.
import http from 'node:http';
const routes = [['/auth/v1', 9999], ['/rest/v1', 3000]];
const TEMPLATE = '<h2>Rangers FC</h2><p>Your sign-in code is {{ .Token }}</p>';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,prefer,accept-profile,content-profile,range,x-supabase-api-version,accept', 'access-control-expose-headers': 'content-range,x-supabase-api-version' };
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.url.startsWith('/templates/')) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(TEMPLATE); }
  const r = routes.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(404, cors); return res.end('{}'); }
  const up = http.request({ host: '127.0.0.1', port: r[1], path: req.url.slice(r[0].length) || '/', method: req.method, headers: { ...req.headers, host: `127.0.0.1:${r[1]}` } }, (u) => {
    res.writeHead(u.statusCode, { ...u.headers, ...cors }); u.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502, cors); res.end(JSON.stringify({ message: e.message })); });
  req.pipe(up);
}).listen(54321, () => console.log('gateway on :54321'));
