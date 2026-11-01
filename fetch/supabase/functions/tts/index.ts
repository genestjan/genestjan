// George's voice: proxies text to ElevenLabs so the API key never reaches the phone.
// Deploy: supabase secrets set ELEVENLABS_API_KEY=... ALLOWED_ORIGIN=https://genestjanramirez.com
//         supabase functions deploy tts --no-verify-jwt
// "George" is an ElevenLabs stock voice (warm British male). Voice id below; change with GEORGE_VOICE_ID.
const VOICE = Deno.env.get('GEORGE_VOICE_ID') ?? 'JBFqnCBsd6RMkjVDRZzb';
const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://genestjanramirez.com';
const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
  const { text } = await req.json().catch(() => ({ text: '' }));
  if (typeof text !== 'string' || !text.trim() || text.length > 400) return new Response('Bad text', { status: 400, headers: cors });
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!r.ok) return new Response('TTS failed', { status: 502, headers: cors });
  return new Response(r.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' } });
});
